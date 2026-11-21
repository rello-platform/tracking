/**
 * The page script's side of the intake protocol (GD-2739, GD-2740, GD-2741, GD-2742).
 *
 *  - rt_q is validated on every read: anything that isn't a well-formed batch is dropped and
 *    counted, never trusted (GD-2739).
 *  - 2xx = stored. 400 / 413 / 422 = refused for good: the batch leaves rt_q and its events are
 *    counted as refused, never retried (GD-2740). Anything else (5xx, 403, network) stays parked.
 *  - Every batch carries `v`, a client visitor id kept in localStorage `rt_v`; a parked batch keeps
 *    the `b` and `v` it was first sent with, so a retry has the same identity (GD-2741).
 *  - The 50 KB cap counts UTF-8 bytes of the stored JSON (GD-2742).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createTransport, QUEUE_KEY, QUEUE_MAX_BYTES, QUEUE_MAX_EVENTS, utf8Bytes, VISITOR_KEY, type Env } from "../src/script/core";

type Body = { b: string; v: string; d?: { m: number; r: number; c: number }; events: Array<{ name: string }> };
type Reply = { ok: boolean; status: number; headers?: { get(k: string): string | null } };

function harness(opts: { replies?: Reply[]; store?: Map<string, string>; throws?: boolean } = {}) {
  const store = opts.store ?? new Map<string, string>();
  const sent: Body[] = [];
  const replies = [...(opts.replies ?? [])];
  let n = 0;
  const env: Env = {
    now: () => Date.now(),
    setTimeout: (f, ms) => setTimeout(f, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    fetch: (_u, init) => {
      sent.push(JSON.parse(init.body) as Body);
      if (opts.throws) return Promise.reject(new Error("offline"));
      return Promise.resolve(replies.shift() ?? { ok: true, status: 204 });
    },
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) },
    random: () => `batch${++n}aaaa`,
  };
  return { t: createTransport(env), sent, store };
}
const q = (store: Map<string, string>) => JSON.parse(store.get(QUEUE_KEY) ?? "[]") as Body[];
const pv = { name: "page.view", pageType: "pricing", path: "/pricing" };

describe("GD-2739: rt_q is validated on read", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test.each([
    ["[null]", 1],
    ['{"not":"an array"}', 1],
    ['[{"b":', 1],
    ['[{"b":"okbatch1","v":"vvvvvvvvvvvvvvvv","events":"no"}]', 1],
    ['[1,"s",[],{"b":5,"events":[]}]', 4],
  ])("rt_q = %s: dropped and counted, and the page's next push still works", async (stored, malformed) => {
    const store = new Map([[QUEUE_KEY, stored]]);
    const { t, sent } = harness({ store, replies: [{ ok: false, status: 503 }] });
    expect(() => t.push(pv)).not.toThrow();
    expect(sent).toHaveLength(1);
    expect(t.stats().malformed).toBe(malformed);
    // What is left in rt_q is well-formed and holds only this page's batch.
    expect(q(store).map((x) => x.events.map((e) => e.name))).toEqual([["page.view"]]);
  });

  test("bad events inside an otherwise good batch are dropped one by one; good ones survive", async () => {
    const good = { b: "earlier01", v: "vvvvvvvvvvvvvvvv", events: [null, 7, { name: 3 }, { name: "scroll.depth", depth: 50 }] };
    const store = new Map([[QUEUE_KEY, JSON.stringify([good])]]);
    const { t, sent } = harness({ store, replies: [{ ok: false, status: 503 }] });
    t.retryParked();
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent.map((s) => s.events.map((e) => e.name))).toEqual([["scroll.depth"]]);
    expect(t.stats().malformed).toBe(3);
  });

  test("a parked batch with no v is malformed (identity can't be recovered), dropped and counted", () => {
    const store = new Map([[QUEUE_KEY, JSON.stringify([{ b: "earlier01", events: [pv] }])]]);
    const { t } = harness({ store });
    t.push(pv);
    expect(t.stats().malformed).toBe(1);
  });
});

describe("GD-2740: 2xx is stored; 400/413/422 are refused for good; anything else is retried", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test.each([400, 413, 422])("%i: the batch leaves rt_q, its events count as refused, and the next page load does not retry it", async (status) => {
    const store = new Map<string, string>();
    const a = harness({ store, replies: [{ ok: false, status }] });
    a.t.push(pv);
    await vi.advanceTimersByTimeAsync(0);
    expect(q(store)).toEqual([]);
    expect(a.t.stats().refused).toBe(1);
    const b = harness({ store });
    b.t.retryParked();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(b.sent).toHaveLength(0);
  });

  test.each([500, 503, 403, 429])("%i: the batch stays parked for the next page load", async (status) => {
    const store = new Map<string, string>();
    const a = harness({ store, replies: [{ ok: false, status }] });
    a.t.push(pv);
    await vi.advanceTimersByTimeAsync(0);
    expect(q(store)).toHaveLength(1);
    expect(a.t.stats().refused).toBe(0);
  });

  test("a network failure stays parked", async () => {
    const store = new Map<string, string>();
    const a = harness({ store, throws: true });
    a.t.push(pv);
    await vi.advanceTimersByTimeAsync(0);
    expect(q(store)).toHaveLength(1);
  });

  test("200 with x-tracking-refused: the batch is settled and the refused events are counted", async () => {
    const store = new Map<string, string>();
    const a = harness({ store, replies: [{ ok: true, status: 200, headers: { get: (k) => (k === "x-tracking-refused" ? "2" : null) } }] });
    a.t.push({ name: "scroll.depth", depth: 25 });
    a.t.push({ name: "scroll.depth", depth: 50 });
    a.t.push(pv); // page.view sends all three at once
    await vi.advanceTimersByTimeAsync(0);
    expect(q(store)).toEqual([]);
    expect(a.t.stats().refused).toBe(2);
  });

  test("the counts ride on the next batch as d, once", async () => {
    const store = new Map([[QUEUE_KEY, "[null]"]]);
    const a = harness({ store, replies: [{ ok: false, status: 422 }] });
    a.t.push(pv); // carries d.m = 1 (the malformed entry was counted on read)
    await vi.advanceTimersByTimeAsync(0);
    a.t.push(pv); // carries d.r = 1 (the 422)
    a.t.push(pv); // nothing new
    expect(a.sent.map((s) => s.d)).toEqual([{ m: 1, r: 0, c: 0 }, { m: 0, r: 1, c: 0 }, undefined]);
  });
});

describe("GD-2741: a retry has the same identity", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("every batch carries v from rt_v, created once", () => {
    const store = new Map<string, string>();
    const { t, sent } = harness({ store });
    t.push(pv);
    t.push(pv);
    expect(new Set(sent.map((s) => s.v)).size).toBe(1);
    expect(sent[0]!.v).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(store.get(VISITOR_KEY)).toBe(sent[0]!.v);
  });

  test("a parked batch is re-sent with the b and v it was first sent with, even after rt_v changed", async () => {
    const store = new Map<string, string>();
    const a = harness({ store, replies: [{ ok: false, status: 503 }] });
    a.t.push(pv);
    await vi.advanceTimersByTimeAsync(0);
    const first = a.sent[0]!;
    store.set(VISITOR_KEY, "a-different-visitor-id-0000");
    const b = harness({ store });
    b.t.retryParked();
    await vi.advanceTimersByTimeAsync(1000);
    expect(b.sent[0]).toMatchObject({ b: first.b, v: first.v });
  });
});

describe("GD-2742: the rt_q cap counts UTF-8 bytes", () => {
  test("utf8Bytes counts bytes, not code units", () => {
    expect(utf8Bytes("abc")).toBe(3);
    expect(utf8Bytes("é")).toBe(2);
    expect(utf8Bytes("界")).toBe(3);
    expect(utf8Bytes("😀")).toBe(4);
    expect(utf8Bytes(JSON.stringify("界😀"))).toBe(Buffer.byteLength(JSON.stringify("界😀")));
  });

  test("200 non-ASCII page views stay under 50 KB of UTF-8 (oldest out), and are counted as capped", () => {
    const store = new Map<string, string>();
    const { t } = harness({ store, replies: Array.from({ length: 400 }, () => ({ ok: false, status: 503 })) });
    for (let i = 0; i < 200; i++) t.push({ ...pv, title: "界".repeat(120) });
    const stored = store.get(QUEUE_KEY)!;
    expect(Buffer.byteLength(stored, "utf8")).toBeLessThanOrEqual(QUEUE_MAX_BYTES);
    const kept = q(store).reduce((a, x) => a + x.events.length, 0);
    expect(kept).toBeLessThan(200);
    expect(kept).toBeGreaterThan(50);
    expect(t.stats().capped).toBe(200 - kept);
  });

  test("ASCII events are still capped at 200 events", () => {
    const store = new Map<string, string>();
    const { t } = harness({ store, replies: Array.from({ length: 400 }, () => ({ ok: false, status: 503 })) });
    for (let i = 0; i < 250; i++) t.push({ name: "cta.click", ctaId: "go" });
    expect(q(store).reduce((a, x) => a + x.events.length, 0)).toBe(QUEUE_MAX_EVENTS);
  });
});

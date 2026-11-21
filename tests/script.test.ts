import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ENDPOINT, FLUSH_MS, QUEUE_KEY, createTransport, matchTemplate, type Env } from "../src/script/core";

type Sent = { via: "fetch" | "beacon"; body: { b: string; gpc?: true; events: Array<{ name: string }> } };

function harness(opts: { fetchOk?: boolean; fetchThrows?: boolean; beacon?: boolean | "missing"; storage?: Map<string, string>; gpc?: boolean } = {}) {
  const sent: Sent[] = [];
  const store = opts.storage ?? new Map<string, string>();
  let n = 0;
  const env: Env = {
    now: () => Date.now(),
    setTimeout: (f, ms) => setTimeout(f, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    fetch: (url, init) => {
      expect(url).toBe(ENDPOINT);
      expect(init.keepalive).toBe(true);
      expect(init.headers["content-type"]).toBe("text/plain");
      sent.push({ via: "fetch", body: JSON.parse(init.body) });
      if (opts.fetchThrows) return Promise.reject(new Error("offline"));
      return Promise.resolve({ ok: opts.fetchOk ?? true });
    },
    sendBeacon:
      opts.beacon === "missing"
        ? undefined
        : (url, body) => {
            sent.push({ via: "beacon", body: JSON.parse(body) });
            return opts.beacon ?? true;
          },
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) },
    random: () => `b${++n}`,
    gpc: opts.gpc,
  };
  return { t: createTransport(env), sent, store };
}

const names = (s: Sent[]) => s.flatMap((x) => x.body.events.map((e) => e.name));

describe("transport (plan §4 Rev 2)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("one page.view plus one scroll.depth in a visible page leave the script within 5 s, with no navigation", async () => {
    const { t, sent } = harness();
    t.push({ name: "page.view", path: "/pricing", pageType: "pricing" });
    expect(names(sent)).toEqual(["page.view"]); // immediate
    t.push({ name: "scroll.depth", path: "/pricing", depth: 25 });
    await vi.advanceTimersByTimeAsync(FLUSH_MS - 1);
    expect(names(sent)).toEqual(["page.view"]);
    await vi.advanceTimersByTimeAsync(1);
    expect(names(sent)).toEqual(["page.view", "scroll.depth"]);
    expect(sent.every((s) => s.via === "fetch")).toBe(true);
    expect(t.pending()).toBe(0);
  });

  test("the 5 s clock starts at the OLDEST unsent event, not the newest", async () => {
    const { t, sent } = harness();
    t.push({ name: "scroll.depth", depth: 25 });
    await vi.advanceTimersByTimeAsync(3000);
    t.push({ name: "scroll.depth", depth: 50 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(names(sent)).toEqual(["scroll.depth", "scroll.depth"]);
  });

  test("cta.click goes at once; 20 buffered events go at once", () => {
    const { t, sent } = harness();
    t.push({ name: "cta.click", ctaId: "start" });
    expect(names(sent)).toEqual(["cta.click"]);
    for (let i = 0; i < 20; i++) t.push({ name: "scroll.depth", depth: 25 });
    expect(sent).toHaveLength(2);
    expect(sent[1]!.body.events).toHaveLength(20);
  });

  test("hide / pagehide sends by beacon", () => {
    const { t, sent } = harness();
    t.push({ name: "page.leave", activeMs: 10 });
    t.flush(true);
    expect(sent.map((s) => s.via)).toEqual(["beacon"]);
  });

  test("a foreground batch is kept in localStorage until a 2xx", async () => {
    const { t, store } = harness({ fetchOk: true });
    t.push({ name: "page.view", pageType: "home", path: "/" });
    expect(store.has(QUEUE_KEY)).toBe(true); // parked while in flight
    await vi.advanceTimersByTimeAsync(0);
    expect(store.has(QUEUE_KEY)).toBe(false); // settled on 2xx
  });

  test.each([
    ["a non-2xx", { fetchOk: false }],
    ["a network error", { fetchThrows: true }],
  ])("%s leaves the batch in rt_q", async (_l, o) => {
    const { t, store } = harness(o);
    t.push({ name: "page.view", pageType: "home", path: "/" });
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.parse(store.get(QUEUE_KEY)!)[0].events[0].name).toBe("page.view");
  });

  test.each([
    ["refused", false],
    ["missing", "missing"],
  ] as const)("a beacon that is %s goes to rt_q", (_l, beacon) => {
    const { t, store } = harness({ beacon });
    t.push({ name: "page.leave", activeMs: 5 });
    t.flush(true);
    expect(JSON.parse(store.get(QUEUE_KEY)!)[0].events[0].name).toBe("page.leave");
  });

  test("rt_q is capped at 200 events, oldest out", () => {
    const { t, store } = harness({ beacon: false });
    for (let i = 0; i < 230; i++) {
      t.push({ name: "scroll.depth", depth: 25, i });
      t.flush(true);
    }
    const q = JSON.parse(store.get(QUEUE_KEY)!) as Array<{ events: Array<{ i: number }> }>;
    const events = q.flatMap((b) => b.events);
    expect(events).toHaveLength(200);
    expect(events[0]!.i).toBe(30);
  });

  test("the next page load retries an earlier page's batches at 1 s, 4 s and 16 s", async () => {
    const store = new Map<string, string>();
    const first = harness({ fetchOk: false, storage: store });
    first.t.push({ name: "page.view", pageType: "home", path: "/" });
    await vi.advanceTimersByTimeAsync(0);

    const next = harness({ fetchOk: false, storage: store });
    next.t.retryParked();
    await vi.advanceTimersByTimeAsync(999);
    expect(next.sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(next.sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(next.sent).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(16000);
    expect(next.sent).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(60000);
    expect(next.sent).toHaveLength(3); // three tries, then it waits for the next page
    expect(new Set(next.sent.map((s) => s.body.b))).toEqual(new Set(["b1"])); // same batch id: the edge stores it once
  });

  test("GPC rides on the batch", () => {
    const { t, sent } = harness({ gpc: true });
    t.push({ name: "page.view", pageType: "home", path: "/" });
    expect(sent[0]!.body.gpc).toBe(true);
  });

  test("storage that throws never reaches the page", () => {
    const { t } = harness({ fetchThrows: true });
    const broken = createTransport({
      now: Date.now,
      setTimeout: (f, ms) => setTimeout(f, ms),
      clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
      random: () => "x",
      storage: { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); }, removeItem: () => { throw new Error("blocked"); } },
    });
    expect(() => broken.push({ name: "page.view", pageType: "home" })).not.toThrow();
    expect(() => t.flush(true)).not.toThrow();
  });
});

describe("matchTemplate in the script (§3.2)", () => {
  test("sends the template or nothing", () => {
    expect(matchTemplate("/c/abc123", ["/c/[token]"])).toBe("/c/[token]");
    expect(matchTemplate("/c/abc123/x", ["/c/[token]"])).toBeUndefined();
    expect(matchTemplate("/", ["/"])).toBe("/");
  });
});

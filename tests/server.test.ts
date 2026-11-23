import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { APP_SLUGS, type AppSlug } from "@rello-platform/slugs";
import { EVENT_SCHEMAS, ROUTES, buildEventSchemas, findNonStrictObjects, findUnboundedStrings, parseEvent } from "../src/index";
import {
  FLUSH_INTERVAL_MS,
  MAX_BATCH_EVENTS,
  MAX_PENDING_EVENTS,
  RETRY_DELAYS_MS,
  SEND_TIMEOUT_MS,
  SERVER_BATCH_SCHEMA,
  createTracker,
  type ServerTrackInput,
  type TrackerOptions,
} from "../src/server";
import { RELLO, VALID } from "./fixtures";

// A fixture feature registry: the package's own FEATURES registers none yet (S9 adds each app's
// in its own release), so an accepted feature.used needs one.
const FEATURES_FIXTURE = Object.fromEntries(APP_SLUGS.map((a) => [a, a === RELLO ? ["leads.create"] : []])) as {
  readonly [A in AppSlug]: readonly string[];
};
const SCHEMAS = buildEventSchemas({ features: FEATURES_FIXTURE, routes: ROUTES });

const ENGINE = "https://engine.example.test/";
const KEY = "rello_KEYSECRETx9";
const TENANT = "tenantSECRETx9";
const VISITOR = "visitorSECRETx9";
const SESSION = "sessionSECRETx9";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Answer = number | "throw" | "network" | "hang" | { status: number; body: unknown } | ((init: RequestInit) => Response);
type Call = { url: string; init: RequestInit; body: { v: number; app: string; batchId: string; events: Array<Record<string, unknown>> }; at: number };

/** A fetch stub that answers from a script (the last answer repeats) and records every call. */
function stubFetch(script: Answer[]) {
  const calls: Call[] = [];
  const aborts: number[] = [];
  const fn = vi.fn((url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const a = script[Math.min(calls.length, script.length - 1)]!;
    calls.push({ url: String(url), init: init!, body: JSON.parse(String(init!.body)), at: Date.now() });
    if (a === "throw") throw new TypeError("fetch threw synchronously");
    if (a === "network") return Promise.reject(new TypeError("fetch failed"));
    if (a === "hang")
      return new Promise((_, reject) =>
        init!.signal!.addEventListener("abort", () => {
          aborts.push(Date.now());
          reject(new DOMException("aborted", "AbortError"));
        }),
      );
    if (typeof a === "function") return Promise.resolve(a(init!));
    if (typeof a === "number") return Promise.resolve(new Response(a === 204 ? null : "{}", { status: a }));
    return Promise.resolve(new Response(JSON.stringify(a.body), { status: a.status, headers: { "content-type": "application/json" } }));
  });
  return { fn: fn as unknown as typeof fetch, calls, aborts };
}

function make(fetchImpl: typeof fetch, over: Partial<TrackerOptions> = {}) {
  const logs: string[] = [];
  const tracker = createTracker({ app: RELLO, engineUrl: ENGINE, apiKey: KEY, fetch: fetchImpl, log: (l) => logs.push(l), schemas: SCHEMAS, ...over });
  return { tracker, logs };
}

const feature = (over: Partial<Extract<ServerTrackInput, { name: "feature.used" }>> = {}): ServerTrackInput => ({ name: "feature.used", tenantId: TENANT, feature: "leads.create", ...over });
const screen = (route: string): ServerTrackInput => ({ name: "screen.opened", tenantId: TENANT, route });
const tick = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-23T17:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("server events carry no edge facts (v0.2.0 schema change)", () => {
  test("feature.used and screen.opened are valid with none of the seven edge facts", () => {
    const base = { id: "3f0e8a52-6d1b-4c1e-9a77-2b9d6c0f4e11", ts: "2026-11-23T17:00:00.000Z", tenantId: "t1", app: RELLO, surface: "in_app" };
    expect(SCHEMAS["feature.used"].safeParse({ name: "feature.used", ...base, feature: "leads.create", count: 1 }).success).toBe(true);
    expect(EVENT_SCHEMAS["screen.opened"].safeParse({ name: "screen.opened", ...base, route: "/leads/[id]" }).success).toBe(true);
  });
  test("browser events still require every edge fact", () => {
    const { country: _c, ...noCountry } = VALID["page.view"]!;
    expect(parseEvent(noCountry).ok).toBe(false);
    const { ipHash: _i, ...noIp } = VALID["cta.click"]!;
    expect(parseEvent(noIp).ok).toBe(false);
  });
  test("the server batch schema is strict and every string in it is bounded", () => {
    expect(findNonStrictObjects(SERVER_BATCH_SCHEMA)).toEqual([]);
    expect(findUnboundedStrings(SERVER_BATCH_SCHEMA)).toEqual([]);
    expect(SERVER_BATCH_SCHEMA.safeParse({ v: 1, app: RELLO, batchId: "3f0e8a52-6d1b-4c1e-9a77-2b9d6c0f4e11", events: [{}] }).success).toBe(true);
    expect(SERVER_BATCH_SCHEMA.safeParse({ v: 1, app: RELLO, batchId: "3f0e8a52-6d1b-4c1e-9a77-2b9d6c0f4e11", events: Array(101).fill({}) }).success).toBe(false);
  });
});

describe("track(): synchronous, buffered, flushed every 10 s or at 100 events (L5)", () => {
  test("track() returns at once and sends nothing before 10 s", async () => {
    const f = stubFetch([204]);
    const { tracker } = make(f.fn);
    expect(tracker.track(feature())).toBeUndefined();
    tracker.track(screen("/leads/[id]"));
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS - 1);
    expect(f.calls).toHaveLength(0);
    expect(tracker.stats().buffered).toBe(2);
  });

  test("the 10 s flush: events below 100 are sent in one batch at 10 s", async () => {
    const f = stubFetch([204]);
    const { tracker } = make(f.fn);
    for (let i = 0; i < 3; i++) tracker.track(feature());
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS - 1);
    expect(f.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.body.events).toHaveLength(3);
    expect(f.calls[0]!.at - Date.parse("2026-11-23T17:00:00.000Z")).toBe(FLUSH_INTERVAL_MS);
    expect(tracker.stats()).toMatchObject({ accepted: 3, buffered: 0, inFlight: 0 });
  });

  test("the 100-event flush: the 100th event sends at once, before any timer", async () => {
    const f = stubFetch([204]);
    const { tracker } = make(f.fn);
    for (let i = 0; i < MAX_BATCH_EVENTS - 1; i++) tracker.track(feature());
    await tick();
    expect(f.calls).toHaveLength(0);
    tracker.track(feature());
    await tick();
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.body.events).toHaveLength(MAX_BATCH_EVENTS);
    expect(f.calls[0]!.at).toBe(Date.parse("2026-11-23T17:00:00.000Z"));
    tracker.track(feature());
    await tick();
    expect(f.calls).toHaveLength(1);
    expect(tracker.stats().buffered).toBe(1);
  });

  test("the wire body: POST <engine>/v1/events, Bearer key, { v: 1, app, batchId, events } of whole stored events", async () => {
    const f = stubFetch([204]);
    const { tracker } = make(f.fn);
    tracker.track(feature({ visitorId: VISITOR, sessionId: SESSION, count: 3 }));
    tracker.track(screen("/leads/[id]"));
    await tracker.flush();
    const c = f.calls[0]!;
    expect(c.url).toBe("https://engine.example.test/v1/events");
    expect(c.init.method).toBe("POST");
    expect((c.init.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`);
    expect((c.init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(SERVER_BATCH_SCHEMA.safeParse(c.body).success).toBe(true);
    expect(c.body).toMatchObject({ v: 1, app: RELLO });
    expect(c.body.batchId).toMatch(UUID);
    const [a, b] = c.body.events;
    expect(a).toEqual({ name: "feature.used", id: a!.id, ts: "2026-11-23T17:00:00.000Z", tenantId: TENANT, app: RELLO, surface: "in_app", visitorId: VISITOR, sessionId: SESSION, feature: "leads.create", count: 3 });
    expect(b).toEqual({ name: "screen.opened", id: b!.id, ts: "2026-11-23T17:00:00.000Z", tenantId: TENANT, app: RELLO, surface: "in_app", route: "/leads/[id]" });
    expect(a!.id).toMatch(UUID);
    expect(a!.id).not.toBe(b!.id);
    for (const e of c.body.events) expect(SCHEMAS[e.name as "feature.used"].safeParse(e).success).toBe(true);
  });

  test("count defaults to 1; a missing optional field is left out, never a reason to hold the event", async () => {
    const f = stubFetch([204]);
    const { tracker } = make(f.fn);
    tracker.track({ name: "feature.used", tenantId: TENANT, feature: "leads.create" });
    await tracker.flush();
    const e = f.calls[0]!.body.events[0]!;
    expect(e.count).toBe(1);
    expect(Object.keys(e).sort()).toEqual(["app", "count", "feature", "id", "name", "surface", "tenantId", "ts"]);
  });
});

describe("sends: a 2 s timeout, 3 retries over about 30 s, only on an unavailable answer", () => {
  test("each attempt times out at 2 s, and the timeout counts as unavailable (retried)", async () => {
    const f = stubFetch(["hang", 204]);
    const { tracker } = make(f.fn);
    tracker.track(feature());
    const p = tracker.flush();
    await vi.advanceTimersByTimeAsync(SEND_TIMEOUT_MS - 1);
    expect(f.aborts).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.aborts).toEqual([Date.parse("2026-11-23T17:00:00.000Z") + SEND_TIMEOUT_MS]);
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    expect(await p).toEqual({ accepted: 1, refused: 0, dropped: 0 });
    expect(f.calls).toHaveLength(2);
  });

  test("3 retries then one counted drop: attempts at 0, 2, 10 and 30 s, then exactly one tracking_events_dropped line", async () => {
    const f = stubFetch([503]);
    const { tracker, logs } = make(f.fn);
    tracker.track(feature());
    tracker.track(feature());
    tracker.track(screen("/leads/[id]"));
    const t0 = Date.now();
    const p = tracker.flush();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await p).toEqual({ accepted: 0, refused: 0, dropped: 3 });
    expect(f.calls.map((c) => c.at - t0)).toEqual([0, 2_000, 10_000, 30_000]);
    expect(new Set(f.calls.map((c) => c.body.batchId)).size).toBe(1);
    const dropped = logs.filter((l) => l.startsWith("tracking_events_dropped"));
    expect(dropped).toEqual(["tracking_events_dropped app=rello count=3 reason=unavailable attempts=4 last_status=503 names=feature.used:2,screen.opened:1"]);
    expect(tracker.stats().droppedUnavailable).toBe(3);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(f.calls).toHaveLength(4);
  });

  for (const a of [503, 502, 504, 500, 429, "network", "throw"] as const) {
    test(`retried on an unavailable answer: ${a}`, async () => {
      const f = stubFetch([a, 204]);
      const { tracker } = make(f.fn);
      tracker.track(feature());
      const p = tracker.flush();
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
      expect(await p).toEqual({ accepted: 1, refused: 0, dropped: 0 });
      expect(f.calls).toHaveLength(2);
    });
  }

  for (const status of [400, 401, 403, 404, 413, 422]) {
    test(`never retried on a refusal: ${status} is one attempt, counted refused`, async () => {
      const f = stubFetch([status, 204]);
      const { tracker, logs } = make(f.fn);
      tracker.track(feature());
      tracker.track(feature());
      const p = tracker.flush();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(await p).toEqual({ accepted: 0, refused: 2, dropped: 0 });
      expect(f.calls).toHaveLength(1);
      expect(tracker.stats()).toMatchObject({ refused: 2, droppedUnavailable: 0 });
      expect(logs).toContain(`tracking_events_refused app=rello count=2 status=${status} names=feature.used:2`);
    });
  }

  test("a partial answer (200 with a refused list) counts the refused events and is not retried", async () => {
    const f = stubFetch([{ status: 200, body: { stored: 2, refused: [{ i: 1, reason: "feature.used: feature: not registered" }] } }]);
    const { tracker } = make(f.fn);
    for (let i = 0; i < 3; i++) tracker.track(feature());
    const p = tracker.flush();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await p).toEqual({ accepted: 2, refused: 1, dropped: 0 });
    expect(f.calls).toHaveLength(1);
  });

  test("no engine URL or no key: nothing is sent, one counted drop line", async () => {
    for (const over of [{ engineUrl: undefined }, { apiKey: () => undefined }, { engineUrl: "not a url" }] as Partial<TrackerOptions>[]) {
      const f = stubFetch([204]);
      const { tracker, logs } = make(f.fn, over);
      tracker.track(feature());
      expect(await tracker.flush()).toEqual({ accepted: 0, refused: 0, dropped: 1 });
      expect(f.calls).toHaveLength(0);
      expect(logs).toEqual(["tracking_events_dropped app=rello count=1 reason=unconfigured names=feature.used:1"]);
    }
  });
});

describe("only registered values leave the process (plan §3.3)", () => {
  test("an unregistered feature is dropped and counted, never sent", async () => {
    const f = stubFetch([204]);
    const { tracker, logs } = make(f.fn);
    tracker.track(feature({ feature: "secret.unregistered" }));
    tracker.track(feature());
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.body.events.map((e) => e.feature)).toEqual(["leads.create"]);
    expect(tracker.stats().droppedAtTrack).toEqual({ unregistered_feature: 1 });
    expect(logs).toContain("tracking_events_invalid app=rello count=1 reasons=unregistered_feature:1");
  });

  test("an unregistered route (a concrete URL) is dropped and counted, never sent", async () => {
    const f = stubFetch([204]);
    const { tracker } = make(f.fn);
    tracker.track(screen("/leads/clx123abc456def789ghi0"));
    tracker.track(screen("/leads/jane-doe@example.com"));
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(f.calls).toHaveLength(0);
    expect(tracker.stats().droppedAtTrack).toEqual({ unregistered_route: 2 });
  });

  test("the package's own FEATURES (none registered yet) refuses every feature.used", async () => {
    const f = stubFetch([204]);
    const { tracker } = make(f.fn, { schemas: undefined });
    tracker.track(feature());
    await tracker.flush();
    expect(f.calls).toHaveLength(0);
    expect(tracker.stats().droppedAtTrack).toEqual({ unregistered_feature: 1 });
  });

  test("out-of-bounds and wrong-type fields are dropped and counted by field name", async () => {
    const f = stubFetch([204]);
    const { tracker } = make(f.fn);
    tracker.track(feature({ count: 0 }));
    tracker.track(feature({ count: 1001 }));
    tracker.track(feature({ tenantId: "has space" }));
    tracker.track({ name: "page.view" } as unknown as ServerTrackInput);
    await tracker.flush();
    expect(f.calls).toHaveLength(0);
    expect(tracker.stats().droppedAtTrack).toEqual({ invalid_count: 2, invalid_tenantId: 1, not_server_event: 1 });
  });
});

describe("track() never throws into the caller", () => {
  test("a throwing fetch: no throw, retried, then one counted drop", async () => {
    const f = stubFetch(["throw"]);
    const { tracker } = make(f.fn);
    expect(() => {
      for (let i = 0; i < MAX_BATCH_EVENTS; i++) tracker.track(feature());
    }).not.toThrow();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.calls).toHaveLength(4);
    expect(tracker.stats()).toMatchObject({ droppedUnavailable: 100, inFlight: 0 });
  });

  test("a throwing schema: no throw, counted as internal_error", () => {
    const throwing = { ...SCHEMAS, "feature.used": { safeParse: () => { throw new Error("schema exploded"); } } } as unknown as typeof SCHEMAS;
    const { tracker } = make(stubFetch([204]).fn, { schemas: throwing });
    expect(() => tracker.track(feature())).not.toThrow();
    expect(tracker.stats().droppedAtTrack).toEqual({ internal_error: 1 });
  });

  test("garbage input, a throwing getter, a throwing logger and a throwing host hook: no throw", async () => {
    const f = stubFetch([422]);
    const { tracker } = make(f.fn, { log: () => { throw new Error("log exploded"); } });
    const evil = Object.defineProperty({ name: "feature.used", feature: "leads.create" }, "tenantId", { get: () => { throw new Error("getter"); } });
    expect(() => {
      tracker.track(null as unknown as ServerTrackInput);
      tracker.track(undefined as unknown as ServerTrackInput);
      tracker.track(evil as unknown as ServerTrackInput);
      for (let i = 0; i < MAX_BATCH_EVENTS; i++) tracker.track(feature(), { defer: () => { throw new Error("defer exploded"); } });
    }).not.toThrow();
    await expect(tracker.flush()).resolves.toBeDefined();
    await tick();
    expect(tracker.stats().refused).toBe(100);
  });

  test("past 10,000 pending events a new event is dropped and counted, never thrown", async () => {
    const f = stubFetch(["hang"]);
    const { tracker } = make(f.fn);
    for (let i = 0; i < MAX_PENDING_EVENTS + 5; i++) tracker.track(feature());
    expect(tracker.stats()).toMatchObject({ inFlight: MAX_PENDING_EVENTS, buffered: 0, droppedAtTrack: { pending_full: 5 } });
  });
});

describe("the host hook (Next.js after() / a Worker's waitUntil)", () => {
  test("a send that track() starts is handed to the per-call defer", async () => {
    const f = stubFetch([204]);
    const { tracker } = make(f.fn);
    const deferred: Promise<unknown>[] = [];
    for (let i = 0; i < MAX_BATCH_EVENTS; i++) tracker.track(feature(), { defer: (p) => deferred.push(p) });
    // Rev 1743 (GD-3042): every call hands its defer a promise. The 99 that only buffered hold the
    // timed send, which the 100th call's send settles; the 100th holds that send itself. One POST.
    expect(deferred).toHaveLength(MAX_BATCH_EVENTS);
    await tick();
    expect(f.calls).toHaveLength(1);
    for (const d of deferred) await expect(d).resolves.toEqual({ accepted: 100, refused: 0, dropped: 0 });
  });

  test("on a Worker (no timer survives the response) a buffer 10 s old is sent by the next track()", async () => {
    const f = stubFetch([204]);
    const { tracker } = make(f.fn);
    const deferred: Promise<unknown>[] = [];
    tracker.track(feature(), { defer: (p) => deferred.push(p) });
    // The clock moves 10 s, but no timer runs (the isolate's timer died with its request).
    vi.setSystemTime(Date.now() + FLUSH_INTERVAL_MS);
    tracker.track(feature(), { defer: (p) => deferred.push(p) });
    // Rev 1743: the first call's defer holds the timed send; the second call starts the send.
    expect(deferred).toHaveLength(2);
    await Promise.all(deferred);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.body.events).toHaveLength(2);
  });

  test("the default hook from createTracker({ defer }) takes the 10 s timer's send", async () => {
    const f = stubFetch([204]);
    const deferred: Promise<unknown>[] = [];
    const { tracker } = make(f.fn, { defer: (p) => deferred.push(p) });
    tracker.track(feature());
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(deferred).toHaveLength(1);
  });
});

describe("no field value in any log line", () => {
  test("drop, refusal, partial, invalid and unconfigured lines carry names and counts only", async () => {
    const values = [TENANT, VISITOR, SESSION, KEY, "engine.example.test", "leads.create", "/leads/[id]", "secret.unregistered", "/leads/jane-doe@example.com"];
    const all: string[] = [];
    for (const script of [[503], [422], [{ status: 200, body: { stored: 1, refused: [{ i: 0, reason: "x" }] } }]] as Answer[][]) {
      const { tracker, logs } = make(stubFetch(script).fn);
      tracker.track(feature({ visitorId: VISITOR, sessionId: SESSION }));
      tracker.track(screen("/leads/[id]"));
      tracker.track(feature({ feature: "secret.unregistered" }));
      tracker.track(screen("/leads/jane-doe@example.com"));
      const p = tracker.flush();
      await vi.advanceTimersByTimeAsync(30_000);
      await p;
      all.push(...logs);
    }
    const { tracker, logs } = make(stubFetch([204]).fn, { apiKey: undefined });
    tracker.track(feature({ visitorId: VISITOR }));
    await tracker.flush();
    all.push(...logs);
    expect(all.length).toBeGreaterThanOrEqual(7);
    for (const line of all) for (const v of values) expect(line, line).not.toContain(v);
    for (const line of all) expect(line).toMatch(/^tracking_events_(dropped|refused|invalid) app=rello count=\d+( [a-z_]+=[A-Za-z0-9_.:,]+)*$/);
  });
});

// ── fix round 1743: AUDIT 138 GD-3041 (an unreadable 200 is unavailable) and GD-3042 (per-call defer) ──

/** A 200 whose headers arrive and whose body then fails as `fail` says. */
const twoHundred = (fail: "abort" | "network" | { raw: string }) => (init: RequestInit): Response => {
  if (typeof fail === "object") return new Response(fail.raw, { status: 200, headers: { "content-type": "application/json" } });
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"stored":1,'));
      if (fail === "network") controller.error(new TypeError("terminated: other side closed"));
      else init.signal!.addEventListener("abort", () => controller.error(new DOMException("The operation was aborted", "AbortError")));
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
};

describe("GD-3041: a 200 whose body can't be read, or isn't the spec's shape, is unavailable", () => {
  const cases: Array<[string, Answer, number]> = [
    ["200 headers, then an AbortError on the body (the 2 s deadline fires mid-body)", twoHundred("abort"), 40_000],
    ["200 headers, then a network failure on the body", twoHundred("network"), 30_000],
    ["200 with invalid JSON", twoHundred({ raw: '{"stored":2,"refused":[' }), 30_000],
    ["200 with refused not an array", twoHundred({ raw: '{"stored":2,"refused":"1"}' }), 30_000],
    ["200 with refused longer than the batch", twoHundred({ raw: '{"stored":0,"refused":[{"i":0},{"i":1},{"i":2},{"i":3}]}' }), 30_000],
    ["200 with no refused list at all", twoHundred({ raw: '{"stored":3}' }), 30_000],
  ];
  for (const [label, answer, ms] of cases) {
    test(`${label}: retried with the same batchId and event ids, then one counted drop`, async () => {
      const f = stubFetch([answer]);
      const { tracker, logs } = make(f.fn);
      for (let i = 0; i < 3; i++) tracker.track(feature());
      const p = tracker.flush();
      await vi.advanceTimersByTimeAsync(ms);
      expect(await p).toEqual({ accepted: 0, refused: 0, dropped: 3 });
      expect(f.calls).toHaveLength(4);
      expect(new Set(f.calls.map((c) => c.body.batchId)).size).toBe(1);
      const ids = f.calls.map((c) => c.body.events.map((e) => e.id).join(","));
      expect(new Set(ids).size).toBe(1);
      expect(logs.filter((l) => l.startsWith("tracking_events_dropped"))).toEqual([
        "tracking_events_dropped app=rello count=3 reason=unavailable attempts=4 last_status=200 names=feature.used:3",
      ]);
      expect(tracker.stats()).toMatchObject({ accepted: 0, droppedUnavailable: 3, inFlight: 0 });
    });
  }

  test("an unreadable 200 then a 204: the retry is accepted, nothing counted twice", async () => {
    const f = stubFetch([twoHundred("network"), 204]);
    const { tracker } = make(f.fn);
    tracker.track(feature());
    tracker.track(feature());
    const p = tracker.flush();
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    expect(await p).toEqual({ accepted: 2, refused: 0, dropped: 0 });
    expect(f.calls).toHaveLength(2);
    expect(f.calls[1]!.body).toEqual(f.calls[0]!.body);
  });

  test("control: a valid partial answer is counted as before (one attempt, refused from the list)", async () => {
    const f = stubFetch([twoHundred({ raw: '{"stored":2,"refused":[{"i":1,"reason":"feature.used: feature: not registered"}]}' })]);
    const { tracker } = make(f.fn);
    for (let i = 0; i < 3; i++) tracker.track(feature());
    const p = tracker.flush();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await p).toEqual({ accepted: 2, refused: 1, dropped: 0 });
    expect(f.calls).toHaveLength(1);
  });
});

describe("GD-3042: a per-call defer keeps the timed send alive", () => {
  test("one event, a per-call defer and no later request: the defer gets a promise and the send happens at 10 s", async () => {
    const f = stubFetch([204]);
    const { tracker } = make(f.fn);
    const deferred: Promise<unknown>[] = [];
    tracker.track(feature(), { defer: (p) => deferred.push(p) });
    expect(deferred).toHaveLength(1);
    let settled = false;
    void deferred[0]!.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS - 1);
    expect(f.calls).toHaveLength(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.at - Date.parse("2026-11-23T17:00:00.000Z")).toBe(FLUSH_INTERVAL_MS);
    await expect(deferred[0]).resolves.toEqual({ accepted: 1, refused: 0, dropped: 0 });
  });

  test("every request that buffers gets the same timed send, and it settles when that send finishes", async () => {
    const f = stubFetch([204]);
    const { tracker } = make(f.fn);
    const deferred: Promise<unknown>[] = [];
    tracker.track(feature(), { defer: (p) => deferred.push(p) });
    await vi.advanceTimersByTimeAsync(4_000);
    tracker.track(screen("/leads/[id]"), { defer: (p) => deferred.push(p) });
    expect(deferred).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.body.events).toHaveLength(2);
    await expect(Promise.all(deferred)).resolves.toEqual([{ accepted: 2, refused: 0, dropped: 0 }, { accepted: 2, refused: 0, dropped: 0 }]);
  });

  test("a handed-off timed promise still settles when a size-triggered send empties the buffer first", async () => {
    const f = stubFetch([204]);
    const { tracker } = make(f.fn);
    const deferred: Promise<unknown>[] = [];
    tracker.track(feature(), { defer: (p) => deferred.push(p) });
    for (let i = 0; i < MAX_BATCH_EVENTS - 1; i++) tracker.track(feature());
    await tick();
    expect(f.calls).toHaveLength(1);
    await expect(deferred[0]).resolves.toEqual({ accepted: 100, refused: 0, dropped: 0 });
  });

  test("options.defer still takes the timer's send when the call passes none", async () => {
    const f = stubFetch([204]);
    const deferred: Promise<unknown>[] = [];
    const { tracker } = make(f.fn, { defer: (p) => deferred.push(p) });
    tracker.track(feature());
    expect(deferred).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(deferred).toHaveLength(1);
    await expect(deferred[0]).resolves.toEqual({ accepted: 1, refused: 0, dropped: 0 });
  });
});

describe("a throwing timer (the case AUDIT 138 found untested)", () => {
  test("setTimeout throws: track() does not throw, the event is not stranded, and its loss is counted", async () => {
    vi.useRealTimers();
    const f = stubFetch([204]);
    const { tracker, logs } = make(f.fn);
    const spy = vi.spyOn(globalThis, "setTimeout").mockImplementation((() => {
      throw new Error("timer exploded");
    }) as unknown as typeof setTimeout);
    const deferred: Promise<unknown>[] = [];
    try {
      expect(() => tracker.track(feature(), { defer: (p) => deferred.push(p) })).not.toThrow();
      expect(deferred).toHaveLength(1);
      await deferred[0];
    } finally {
      spy.mockRestore();
    }
    expect(tracker.stats()).toMatchObject({ buffered: 0, inFlight: 0, droppedUnavailable: 1, droppedAtTrack: {} });
    expect(logs).toEqual(["tracking_events_dropped app=rello count=1 reason=internal names=feature.used:1"]);
  });
});

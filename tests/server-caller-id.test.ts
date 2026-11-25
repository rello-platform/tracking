/**
 * v0.7.0 (U23b, Platform KA 1966): `track()` takes an optional caller event id.
 *
 * - a caller id is the event's id on the wire (feature.used and screen.opened);
 * - no id → the package mints a fresh v4 UUID per event, as before;
 * - a supplied id that is not a UUID is refused at track() by the event schema's own `id: z.uuid()`,
 *   dropped and counted (`invalid_id`) like any other invalid field: never sent, never replaced by a
 *   minted id, and its value never in a log line;
 * - a caller id is kept on every attempt of the package's own retries (the engine dedupes by id).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { APP_SLUGS, type AppSlug } from "@rello-platform/slugs";
import { ROUTES, buildEventSchemas } from "../src/index";
import { RETRY_DELAYS_MS, createTracker, type ServerTrackInput } from "../src/server";
import { RELLO } from "./fixtures";

const FEATURES_FIXTURE = Object.fromEntries(APP_SLUGS.map((a) => [a, a === RELLO ? ["leads.create"] : []])) as {
  readonly [A in AppSlug]: readonly string[];
};
const SCHEMAS = buildEventSchemas({ features: FEATURES_FIXTURE, routes: ROUTES });

const ENGINE = "https://engine.example.test";
const KEY = "rello_KEYSECRETx9";
const TENANT = "tenantSECRETx9";
const CALLER_ID = "3e7d9a1c-5b2f-4c8e-9d0a-1b2c3d4e5f60";
const OTHER_ID = "9b1f0c2d-7a6e-4f3b-8c5d-0e1f2a3b4c5d";
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type Sent = { batchId: string; events: Array<Record<string, unknown>> };

/** A fetch stub answering from a script (the last answer repeats); records every body. */
function harness(script: number[] = [204]) {
  const bodies: Sent[] = [];
  const logs: string[] = [];
  const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit): Promise<Response> => {
    bodies.push(JSON.parse(String(init?.body)));
    const status = script[Math.min(bodies.length - 1, script.length - 1)]!;
    return new Response(status === 204 ? null : "{}", { status });
  });
  const tracker = createTracker({ app: RELLO, engineUrl: ENGINE, apiKey: KEY, fetch: fetchFn as unknown as typeof fetch, log: (l) => void logs.push(l), schemas: SCHEMAS });
  return { tracker, bodies, logs, fetchFn };
}

const feature = (over: Record<string, unknown> = {}): ServerTrackInput =>
  ({ name: "feature.used", tenantId: TENANT, feature: "leads.create", ...over }) as ServerTrackInput;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-25T14:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("v0.7.0: a caller id is the id on the wire", () => {
  test("feature.used with an id → that exact id on the sent event, every other field as without one", async () => {
    const x = harness();
    x.tracker.track(feature({ id: CALLER_ID }));
    x.tracker.track(feature());
    await x.tracker.flush();
    expect(x.bodies).toHaveLength(1);
    const [withId, without] = x.bodies[0]!.events;
    expect(withId!.id).toBe(CALLER_ID);
    const { id: _a, ...restWith } = withId!;
    const { id: _b, ...restWithout } = without!;
    expect(restWith).toEqual(restWithout);
    expect(Object.keys(withId!)).toEqual(Object.keys(without!));
    expect(SCHEMAS["feature.used"].safeParse(withId).success).toBe(true);
  });

  test("screen.opened with an id → that exact id on the sent event", async () => {
    const x = harness();
    x.tracker.track({ name: "screen.opened", tenantId: TENANT, route: "/leads/[id]", id: OTHER_ID });
    await x.tracker.flush();
    expect(x.bodies[0]!.events.map((e) => [e.name, e.id])).toEqual([["screen.opened", OTHER_ID]]);
  });

  test("no id → a fresh v4 UUID per event (two events, two ids), never the caller id of another event", async () => {
    const x = harness();
    x.tracker.track(feature());
    x.tracker.track(feature());
    x.tracker.track(feature({ id: CALLER_ID }));
    await x.tracker.flush();
    const ids = x.bodies[0]!.events.map((e) => String(e.id));
    expect(ids).toHaveLength(3);
    expect(ids[0]).toMatch(V4);
    expect(ids[1]).toMatch(V4);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids.slice(0, 2)).not.toContain(CALLER_ID);
    expect(ids[2]).toBe(CALLER_ID);
  });
});

describe("v0.7.0: a supplied id that is not a UUID is refused at track(), never sent, never replaced", () => {
  const BAD: unknown[] = ["", "evt_1", "3e7d9a1c5b2f4c8e9d0a1b2c3d4e5f60", `${CALLER_ID} `, `{${CALLER_ID}}`, "not-a-uuid-at-all-0000-000000000000", null, 42, {}];

  test("each bad id: dropped and counted invalid_id at track(), nothing buffered, nothing sent", async () => {
    const x = harness();
    for (const bad of BAD) x.tracker.track(feature({ id: bad }));
    expect(x.tracker.stats()).toMatchObject({ buffered: 0, droppedAtTrack: { invalid_id: BAD.length } });
    await x.tracker.flush();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(x.fetchFn).not.toHaveBeenCalled();
    expect(x.logs).toEqual([`tracking_events_invalid app=rello count=${BAD.length} reasons=invalid_id:${BAD.length}`]);
  });

  test("a bad id beside a good event: only the good event is sent, under its own id", async () => {
    const x = harness();
    x.tracker.track(feature({ id: "evt_1" }));
    x.tracker.track(feature({ id: CALLER_ID }));
    await x.tracker.flush();
    expect(x.bodies).toHaveLength(1);
    expect(x.bodies[0]!.events.map((e) => e.id)).toEqual([CALLER_ID]);
    expect(x.tracker.stats().droppedAtTrack).toEqual({ invalid_id: 1 });
  });

  test("an id that is undefined is no id: a fresh UUID (the type's optional field)", async () => {
    const x = harness();
    x.tracker.track(feature({ id: undefined }));
    await x.tracker.flush();
    expect(String(x.bodies[0]!.events[0]!.id)).toMatch(V4);
  });
});

describe("v0.7.0: a caller id is kept across the package's own retries", () => {
  test("503, 503, 204 → three attempts of the same batch, each carrying the caller id", async () => {
    const x = harness([503, 503, 204]);
    x.tracker.track(feature({ id: CALLER_ID }));
    const p = x.tracker.flush();
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] + RETRY_DELAYS_MS[1]);
    expect(await p).toEqual({ accepted: 1, refused: 0, dropped: 0 });
    expect(x.bodies).toHaveLength(3);
    expect(new Set(x.bodies.map((b) => b.batchId)).size).toBe(1);
    expect(x.bodies.map((b) => b.events.map((e) => e.id))).toEqual([[CALLER_ID], [CALLER_ID], [CALLER_ID]]);
  });
});

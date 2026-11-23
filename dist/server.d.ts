/**
 * `@rello-platform/tracking/server` — the in-app SERVER sender (PLATFORM-TRACKING-SYSTEM S9;
 * plan §5.5 Rev 2, row L5 "Server senders" and the seam "Sign-in and app requests").
 *
 *   const tracker = createTracker({ app: "rello", engineUrl, apiKey });
 *   tracker.track({ name: "feature.used", tenantId, feature: "leads.create" });   // returns at once
 *
 * L5, exactly:
 *   - `track()` returns synchronously and never throws into the caller (every path is caught and
 *     counted). Nothing a request does waits on it.
 *   - Each event is validated with the package's own schemas and registries before it is buffered.
 *     An unregistered feature or route, or any other invalid event, is dropped and counted, never
 *     sent (plan §3.3: no free text; only a registered template or feature key leaves the process).
 *   - Events buffer in process and are sent every ≤ 10 s, or at once when 100 are waiting,
 *     whichever comes first. One send is one POST of ≤ 100 events to `<engine>/v1/events`.
 *   - Each attempt has a 2 s timeout. Only an UNAVAILABLE answer is retried (no answer, a timeout,
 *     429, or 5xx, or a 200 whose body can't be read or isn't exactly the spec's partial answer, see
 *     `partialRefusedCount`), up to 3 times over about 30 s (at 2 s, 10 s and 30 s), always
 *     the same batch (same batchId and event ids). A refusal (any other 4xx) is never retried. After the last retry the batch is dropped with ONE counted log line:
 *     `tracking_events_dropped app=<slug> count=<n> reason=unavailable attempts=4 names=<name>:<n>,…`
 *   - Log lines carry the app slug, event names, counts, reasons and HTTP statuses only: never a
 *     field value (no tenant, visitor, feature, route, key or URL).
 *   - The host hook: `track(input, { defer })` hands `defer` (Next.js `after()` or a Worker's
 *     `ctx.waitUntil`) a promise every time: the send the call starts, or, when the call only
 *     buffers, the 10 s timed send, which settles when that send (or an earlier one that empties
 *     the buffer) finishes. So a Worker request that tracks one event and is never followed by
 *     another still keeps its timed send alive (GD-3042). `createTracker({ defer })` sets a default
 *     hook that takes the timer's own send; a per-call `defer` wins for the sends a call starts
 *     (a Worker's ctx belongs to one request, so pass it per call).
 *
 * Losses, as L5 states them: a process that dies loses its buffer without a log line; retries that
 * run out are counted. There is deliberately no hub outbox (plan §5.5 L5).
 *
 * Runtime: no Node-only or browser-only API. It uses `fetch`, `AbortController`, `setTimeout`,
 * `crypto.randomUUID` and JSON, which Node ≥ 19 and Cloudflare Workers both provide. A timer's
 * `unref()` is called only where it exists (Node), so an idle buffer never holds a Node process open.
 */
import { z } from "zod";
import { type AppSlug } from "@rello-platform/slugs";
import { type buildEventSchemas } from "./schemas.js";
/** The engine route the helper posts to, relative to the engine's base URL. */
export declare const SERVER_INTAKE_PATH = "/v1/events";
/** L5: a buffered event waits at most this long before a send starts. */
export declare const FLUSH_INTERVAL_MS = 10000;
/** L5: a send starts at once when this many events are waiting; also the batch limit. */
export declare const MAX_BATCH_EVENTS = 100;
/** The largest server batch body the engine accepts, in bytes (100 events at their schema maxima fit). */
export declare const SERVER_BATCH_MAX_BYTES: number;
/** L5 seam: each attempt's timeout. */
export declare const SEND_TIMEOUT_MS = 2000;
/** L5: the waits before retries 1, 2 and 3 (sends at 0, 2, 10 and 30 s: about 30 s in all). */
export declare const RETRY_DELAYS_MS: readonly [2000, 8000, 20000];
/** Memory bound: buffered plus in-flight events. Past it a new event is dropped and counted. */
export declare const MAX_PENDING_EVENTS = 10000;
/**
 * The body of `POST <engine>/v1/events`. `batchId` is the same on every retry of one batch; each
 * event carries its own `id` (a v4 UUID), which is the engine's idempotency key. Every event is a
 * whole stored event (`EVENT_SCHEMAS[name]`); the engine re-validates each one.
 */
export declare const SERVER_BATCH_SCHEMA: z.ZodObject<{
    v: z.ZodLiteral<1>;
    app: z.ZodEnum<{
        arive: "arive";
        rello: "rello";
        "harvest-home": "harvest-home";
        "home-ready": "home-ready";
        "home-stretch": "home-stretch";
        "home-scout": "home-scout";
        "market-intel": "market-intel";
        "newsletter-studio": "newsletter-studio";
        "the-oven": "the-oven";
        "the-drumbeat": "the-drumbeat";
        "open-house-hub": "open-house-hub";
        "pathfinder-pro": "pathfinder-pro";
        "prequal-pro": "prequal-pro";
    }>;
    batchId: z.ZodUUID;
    events: z.ZodArray<z.ZodUnknown>;
}, z.core.$strict>;
export type ServerBatch = {
    v: 1;
    app: AppSlug;
    batchId: string;
    events: ServerEvent[];
};
/** What a server event looks like on the wire (the stored schema's own shape). */
export type ServerEvent = ({
    name: "feature.used";
    feature: string;
    count: number;
} & ServerCommon) | ({
    name: "screen.opened";
    route: string;
} & ServerCommon);
type ServerCommon = {
    id: string;
    ts: string;
    tenantId: string;
    app: AppSlug;
    surface: "in_app";
    visitorId?: string;
    sessionId?: string;
};
/** What a caller passes. The tenant is the one the app's own signed-in session attests (plan §9.2). */
export type ServerTrackInput = {
    name: "feature.used";
    tenantId: string;
    feature: string;
    count?: number;
    visitorId?: string;
    sessionId?: string;
} | {
    name: "screen.opened";
    tenantId: string;
    route: string;
    visitorId?: string;
    sessionId?: string;
};
/** The host hook: Next.js `after`, or a Worker's `ctx.waitUntil`. */
export type Defer = (p: Promise<unknown>) => void;
export type EventSchemas = ReturnType<typeof buildEventSchemas>;
export interface TrackerOptions {
    /** This app's canonical slug. Every event carries it; the engine checks it against the key's appSource. */
    app: AppSlug;
    /** The engine's base URL, e.g. `https://events.hellorello.app`. Missing → nothing is sent, counted. */
    engineUrl: string | undefined;
    /** The app's `<APP>` → TRACKING_ENGINE key (`tracking:write`). A function is read at send time. */
    apiKey: string | undefined | (() => string | undefined);
    /** Defaults to the global `fetch`, looked up at send time. */
    fetch?: typeof fetch;
    /** Where log lines go. Defaults to `console.warn`. */
    log?: (line: string) => void;
    /** The default host hook for sends a `track()` call starts. */
    defer?: Defer;
    /** Defaults to the package's `EVENT_SCHEMAS`. Tests pass schemas built over a fixture registry. */
    schemas?: EventSchemas;
}
export interface TrackerStats {
    /** Events the engine stored. */
    accepted: number;
    /** Events the engine refused (a 4xx for the batch, or listed in a partial answer). Never retried. */
    refused: number;
    /** Events dropped after the last retry found the engine unavailable. */
    droppedUnavailable: number;
    /** Events dropped before sending because the engine URL or key is not configured. */
    droppedUnconfigured: number;
    /** Events dropped at `track()`: invalid (by reason), the pending bound, or an internal error. */
    droppedAtTrack: Record<string, number>;
    /** Events waiting for a send. */
    buffered: number;
    /** Events inside a send that has not finished. */
    inFlight: number;
}
export interface FlushResult {
    accepted: number;
    refused: number;
    dropped: number;
}
export interface Tracker {
    /** Validate and buffer one event. Returns at once; never throws. */
    track(input: ServerTrackInput, host?: {
        defer?: Defer;
    }): void;
    /** Send everything buffered now and wait for those sends (retries included). Never rejects. */
    flush(): Promise<FlushResult>;
    stats(): TrackerStats;
}
/** Classify an answer. Only "unavailable" is retried. */
export declare function classifyStatus(status: number): "accepted" | "refused" | "unavailable";
/**
 * The refused count of a 200 partial answer for a batch of `events`, or `null` when the body is not
 * EXACTLY the spec's partial answer (SPEC-S9-ENGINE-SERVER-INTAKE §4 step 8, Rev 1743):
 *
 *   `{ "stored": <int>, "refused": [{ "i": <int>, "reason": <string> }, …] }`
 *
 * - `stored` a non-negative integer;
 * - `refused` a non-empty array (all stored is a 204, not a 200) of `{ i, reason }`, each `i` an integer
 *   with `0 ≤ i < events` and no `i` twice, each `reason` a non-empty string;
 * - no other key, at the top or on an entry ("exactly");
 * - `stored + refused.length === events`.
 *
 * `null` means the helper cannot know what was stored, so the batch is UNAVAILABLE and retried with the
 * same batchId and event ids, then one counted drop; never counted accepted. GD-3041 (AUDIT 138, KA 1743)
 * added the unreadable-body and refused-array checks; GD-3047 (AUDIT 138, KA 1752) the rest.
 */
export declare function partialRefusedCount(body: unknown, events: number): number | null;
export declare function createTracker(options: TrackerOptions): Tracker;
export {};
//# sourceMappingURL=server.d.ts.map
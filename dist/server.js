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
 *     429, or 5xx, or a 200 whose body can't be read or isn't `{ stored, refused: [...] }` with no
 *     more refusals than events sent), up to 3 times over about 30 s (at 2 s, 10 s and 30 s), always
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
import { APP_SLUGS } from "@rello-platform/slugs";
import { EVENT_SCHEMAS, SERVER_EVENT_NAMES } from "./schemas.js";
// ── the contract (the engine intake builds to the same values: SPEC-S9-ENGINE-SERVER-INTAKE) ──
/** The engine route the helper posts to, relative to the engine's base URL. */
export const SERVER_INTAKE_PATH = "/v1/events";
/** L5: a buffered event waits at most this long before a send starts. */
export const FLUSH_INTERVAL_MS = 10_000;
/** L5: a send starts at once when this many events are waiting; also the batch limit. */
export const MAX_BATCH_EVENTS = 100;
/** The largest server batch body the engine accepts, in bytes (100 events at their schema maxima fit). */
export const SERVER_BATCH_MAX_BYTES = 128 * 1024;
/** L5 seam: each attempt's timeout. */
export const SEND_TIMEOUT_MS = 2_000;
/** L5: the waits before retries 1, 2 and 3 (sends at 0, 2, 10 and 30 s: about 30 s in all). */
export const RETRY_DELAYS_MS = [2_000, 8_000, 20_000];
/** Memory bound: buffered plus in-flight events. Past it a new event is dropped and counted. */
export const MAX_PENDING_EVENTS = 10_000;
/**
 * The body of `POST <engine>/v1/events`. `batchId` is the same on every retry of one batch; each
 * event carries its own `id` (a v4 UUID), which is the engine's idempotency key. Every event is a
 * whole stored event (`EVENT_SCHEMAS[name]`); the engine re-validates each one.
 */
export const SERVER_BATCH_SCHEMA = z
    .object({
    v: z.literal(1),
    app: z.enum(APP_SLUGS),
    batchId: z.uuid(),
    events: z.array(z.unknown()).min(1).max(MAX_BATCH_EVENTS),
})
    .strict();
const SERVER_NAMES = new Set(SERVER_EVENT_NAMES);
/** A key a log line may carry for a schema issue: a schema field name, never input. */
const reasonFor = (issues) => {
    const first = issues[0];
    const field = typeof first?.path[0] === "string" ? first.path[0] : "";
    if (field === "feature" && /not registered/.test(first?.message ?? ""))
        return "unregistered_feature";
    if (field === "route" && /not a registered/.test(first?.message ?? ""))
        return "unregistered_route";
    return /^[A-Za-z]{1,32}$/.test(field) ? `invalid_${field}` : "invalid_event";
};
const namesOf = (events) => {
    const n = new Map();
    for (const e of events)
        n.set(e.name, (n.get(e.name) ?? 0) + 1);
    return [...n.entries()].map(([k, v]) => `${k}:${v}`).join(",");
};
/** Classify an answer. Only "unavailable" is retried. */
export function classifyStatus(status) {
    if (status >= 200 && status < 300)
        return "accepted";
    if (status === 429 || (status >= 500 && status < 600))
        return "unavailable";
    return "refused";
}
/**
 * GD-3041 (AUDIT 138, KA 1743): the refused count of a 200 partial answer
 * `{ stored, refused: [{ i, reason }] }` for a batch of `events`, or `null` when the body is not
 * that shape (not an object, `refused` not an array, or more refusals than events sent). `null`
 * means the helper cannot know what was stored, so the batch is UNAVAILABLE and retried, never
 * counted accepted.
 */
export function partialRefusedCount(body, events) {
    if (body === null || typeof body !== "object" || Array.isArray(body))
        return null;
    const refused = body.refused;
    if (!Array.isArray(refused) || refused.length > events)
        return null;
    return refused.length;
}
export function createTracker(options) {
    const app = options.app;
    const schemas = options.schemas ?? EVENT_SCHEMAS;
    const log = (line) => {
        try {
            (options.log ?? ((l) => console.warn(l)))(line);
        }
        catch {
            // A throwing logger must not reach the caller either.
        }
    };
    let buffer = [];
    let oldestAt = null;
    let timer = null;
    let inFlight = 0;
    const atTrack = new Map();
    const pendingDropLog = new Map();
    const stats = { accepted: 0, refused: 0, droppedUnavailable: 0, droppedUnconfigured: 0 };
    const countAtTrack = (reason) => {
        atTrack.set(reason, (atTrack.get(reason) ?? 0) + 1);
        pendingDropLog.set(reason, (pendingDropLog.get(reason) ?? 0) + 1);
    };
    /** One line for everything dropped at track() since the last one (reasons and counts only). */
    const logTrackDrops = () => {
        if (pendingDropLog.size === 0)
            return;
        const count = [...pendingDropLog.values()].reduce((a, b) => a + b, 0);
        const reasons = [...pendingDropLog.entries()].map(([k, v]) => `${k}:${v}`).join(",");
        pendingDropLog.clear();
        log(`tracking_events_invalid app=${app} count=${count} reasons=${reasons}`);
    };
    const endpoint = () => {
        const base = typeof options.engineUrl === "string" ? options.engineUrl.trim().replace(/\/+$/, "") : "";
        return /^https?:\/\/[^\s/]+/.test(base) ? `${base}${SERVER_INTAKE_PATH}` : null;
    };
    const key = () => {
        try {
            const k = typeof options.apiKey === "function" ? options.apiKey() : options.apiKey;
            return typeof k === "string" && k.trim().length > 0 ? k.trim() : null;
        }
        catch {
            return null;
        }
    };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    async function attemptOnce(url, bearer, body, events) {
        let t;
        try {
            const ac = new AbortController();
            t = setTimeout(() => ac.abort(), SEND_TIMEOUT_MS);
            const doFetch = options.fetch ?? globalThis.fetch;
            const res = await doFetch(url, {
                method: "POST",
                headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` },
                body,
                signal: ac.signal,
                redirect: "manual",
            });
            const kind = classifyStatus(res.status);
            if (kind === "unavailable")
                return { kind, status: res.status };
            if (kind === "refused")
                return { kind, status: res.status };
            if (res.status !== 200)
                return { kind: "accepted", refused: 0 };
            // 200 = partly refused: `{ stored, refused: [...] }`. GD-3041 (AUDIT 138, KA 1743): a 200 whose
            // body can't be read (the 2 s deadline firing mid-body, a network drop, invalid JSON) or isn't
            // that shape is UNAVAILABLE, never accepted. The same batch is retried (same batchId and event
            // ids; the engine dedupes by id, so a resend is safe).
            let parsed;
            try {
                parsed = await res.json();
            }
            catch {
                return { kind: "unavailable", status: 200 };
            }
            const refused = partialRefusedCount(parsed, events);
            return refused === null ? { kind: "unavailable", status: 200 } : { kind: "accepted", refused };
        }
        catch {
            // No answer: a network error, the 2 s timeout, a throwing fetch or a throwing timer.
            return { kind: "unavailable", status: null };
        }
        finally {
            if (t !== undefined)
                clearTimeout(t);
        }
    }
    async function sendBatch(events) {
        inFlight += events.length;
        try {
            const url = endpoint();
            const bearer = key();
            if (url === null || bearer === null) {
                stats.droppedUnconfigured += events.length;
                log(`tracking_events_dropped app=${app} count=${events.length} reason=unconfigured names=${namesOf(events)}`);
                return { accepted: 0, refused: 0, dropped: events.length };
            }
            const body = JSON.stringify({ v: 1, app, batchId: crypto.randomUUID(), events });
            let last = { kind: "unavailable", status: null };
            for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
                if (attempt > 0)
                    await sleep(RETRY_DELAYS_MS[attempt - 1]);
                last = await attemptOnce(url, bearer, body, events.length);
                if (last.kind === "accepted") {
                    stats.accepted += events.length - last.refused;
                    stats.refused += last.refused;
                    if (last.refused > 0)
                        log(`tracking_events_refused app=${app} count=${last.refused} status=200 of=${events.length}`);
                    return { accepted: events.length - last.refused, refused: last.refused, dropped: 0 };
                }
                if (last.kind === "refused") {
                    stats.refused += events.length;
                    log(`tracking_events_refused app=${app} count=${events.length} status=${last.status} names=${namesOf(events)}`);
                    return { accepted: 0, refused: events.length, dropped: 0 };
                }
            }
            stats.droppedUnavailable += events.length;
            const status = last.kind === "unavailable" && last.status !== null ? String(last.status) : "none";
            log(`tracking_events_dropped app=${app} count=${events.length} reason=unavailable attempts=${RETRY_DELAYS_MS.length + 1} last_status=${status} names=${namesOf(events)}`);
            return { accepted: 0, refused: 0, dropped: events.length };
        }
        catch {
            // Defensive: nothing above should throw, but a send must never reject.
            stats.droppedUnavailable += events.length;
            log(`tracking_events_dropped app=${app} count=${events.length} reason=internal names=${namesOf(events)}`);
            return { accepted: 0, refused: 0, dropped: events.length };
        }
        finally {
            inFlight -= events.length;
        }
    }
    const clearTimer = () => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    };
    /**
     * GD-3042 (AUDIT 138, KA 1743): the send the armed timer will start, as a promise a per-call
     * `defer` can hold. It settles when the NEXT send of the buffer finishes: the timer's, or an
     * earlier one (100 events, an old buffer, `flush()`), so a promise handed to a Worker's
     * `waitUntil` never outlives the buffer it protects. Made lazily, only when a call hands it on.
     */
    let timed = null;
    const timedSend = () => {
        if (timed === null) {
            let settle = () => undefined;
            const promise = new Promise((resolve) => {
                settle = (p) => resolve(p);
            });
            timed = { promise, settle };
        }
        return timed.promise;
    };
    /** Take everything buffered and send it, ≤ 100 events per POST. Never rejects. */
    function sendAll() {
        clearTimer();
        logTrackDrops();
        const sends = [];
        while (buffer.length > 0)
            sends.push(sendBatch(buffer.splice(0, MAX_BATCH_EVENTS)));
        buffer = [];
        oldestAt = null;
        const result = Promise.all(sends).then((rs) => rs.reduce((a, r) => ({ accepted: a.accepted + r.accepted, refused: a.refused + r.refused, dropped: a.dropped + r.dropped }), { accepted: 0, refused: 0, dropped: 0 }), () => ({ accepted: 0, refused: 0, dropped: 0 }));
        if (timed !== null) {
            const handedOut = timed;
            timed = null;
            handedOut.settle(result);
        }
        return result;
    }
    /** Hand a promise to a host hook. A throwing hook never reaches the caller. */
    const handOff = (defer, p) => {
        if (!defer)
            return;
        try {
            defer(p);
        }
        catch {
            // The send is already running (or armed); nothing reaches the caller.
        }
    };
    /** Start a send now, handed to the host hook when there is one. */
    const startSend = (defer) => {
        handOff(defer, sendAll());
    };
    /** Arm the 10 s timer once. `false` when this runtime's setTimeout throws: no timer is armed. */
    const armTimer = () => {
        if (timer !== null)
            return true;
        try {
            timer = setTimeout(() => {
                timer = null;
                startSend(options.defer);
            }, FLUSH_INTERVAL_MS);
        }
        catch {
            timer = null;
            return false;
        }
        try {
            const t = timer;
            if (typeof t.unref === "function")
                t.unref();
        }
        catch {
            // unref is a Node nicety; without it the timer still fires.
        }
        return true;
    };
    function build(input) {
        if (input === null || typeof input !== "object")
            return { ok: false, reason: "invalid_event" };
        const name = input.name;
        if (typeof name !== "string" || !SERVER_NAMES.has(name))
            return { ok: false, reason: "not_server_event" };
        const common = {
            id: crypto.randomUUID(),
            ts: new Date().toISOString(),
            tenantId: input.tenantId,
            app,
            surface: "in_app",
            // Optional: left out when the caller has none (never a reason to hold the event).
            ...(input.visitorId !== undefined ? { visitorId: input.visitorId } : {}),
            ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        };
        const candidate = input.name === "feature.used"
            ? { name: input.name, ...common, feature: input.feature, count: input.count ?? 1 }
            : { name: input.name, ...common, route: input.route };
        const r = schemas[name].safeParse(candidate);
        if (!r.success)
            return { ok: false, reason: reasonFor(r.error.issues) };
        return { ok: true, event: r.data };
    }
    return {
        track(input, host) {
            try {
                const built = build(input);
                if (!built.ok) {
                    countAtTrack(built.reason);
                    armTimer();
                    return;
                }
                if (buffer.length + inFlight >= MAX_PENDING_EVENTS) {
                    countAtTrack("pending_full");
                    armTimer();
                    return;
                }
                buffer.push(built.event);
                const now = Date.now();
                if (oldestAt === null)
                    oldestAt = now;
                const defer = host?.defer ?? options.defer;
                if (buffer.length >= MAX_BATCH_EVENTS || now - oldestAt >= FLUSH_INTERVAL_MS)
                    startSend(defer);
                // No timer can be armed (a throwing setTimeout): send now rather than strand the event.
                else if (!armTimer())
                    startSend(defer);
                // GD-3042: this call only buffered. Its per-call hook holds the timed send (≤ 10 s), so a
                // Worker's waitUntil keeps it alive with no later request. options.defer keeps taking the
                // timer's send as before.
                else
                    handOff(host?.defer, timedSend());
            }
            catch {
                try {
                    countAtTrack("internal_error");
                }
                catch {
                    // Nothing more can be done without risking a throw into the caller.
                }
            }
        },
        flush() {
            try {
                return sendAll();
            }
            catch {
                return Promise.resolve({ accepted: 0, refused: 0, dropped: 0 });
            }
        },
        stats() {
            return { ...stats, droppedAtTrack: Object.fromEntries(atTrack), buffered: buffer.length, inFlight };
        },
    };
}

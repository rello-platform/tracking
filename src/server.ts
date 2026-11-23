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
 *     429, or 5xx), up to 3 times over about 30 s (at 2 s, 10 s and 30 s). A refusal (any other
 *     4xx) is never retried. After the last retry the batch is dropped with ONE counted log line:
 *     `tracking_events_dropped app=<slug> count=<n> reason=unavailable attempts=4 names=<name>:<n>,…`
 *   - Log lines carry the app slug, event names, counts, reasons and HTTP statuses only: never a
 *     field value (no tenant, visitor, feature, route, key or URL).
 *   - The host hook: `track(input, { defer })` hands any send that call starts to `defer`, which is
 *     Next.js `after()` or a Worker's `ctx.waitUntil`, so the send runs after the response. On a
 *     Worker a timer does not outlive the response, so there a send starts on the first `track()`
 *     after the buffer is 10 s old. `createTracker({ defer })` sets a default hook; a per-call
 *     `defer` wins (a Worker's ctx belongs to one request, so pass it per call).
 *
 * Losses, as L5 states them: a process that dies loses its buffer without a log line; retries that
 * run out are counted. There is deliberately no hub outbox (plan §5.5 L5).
 *
 * Runtime: no Node-only or browser-only API. It uses `fetch`, `AbortController`, `setTimeout`,
 * `crypto.randomUUID` and JSON, which Node ≥ 19 and Cloudflare Workers both provide. A timer's
 * `unref()` is called only where it exists (Node), so an idle buffer never holds a Node process open.
 */
import { z } from "zod";
import { APP_SLUGS, type AppSlug } from "@rello-platform/slugs";
import { EVENT_SCHEMAS, SERVER_EVENT_NAMES, type ServerEventName, type buildEventSchemas } from "./schemas.js";

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
export const RETRY_DELAYS_MS = [2_000, 8_000, 20_000] as const;
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
export type ServerBatch = { v: 1; app: AppSlug; batchId: string; events: ServerEvent[] };

/** What a server event looks like on the wire (the stored schema's own shape). */
export type ServerEvent =
  | ({ name: "feature.used"; feature: string; count: number } & ServerCommon)
  | ({ name: "screen.opened"; route: string } & ServerCommon);
type ServerCommon = { id: string; ts: string; tenantId: string; app: AppSlug; surface: "in_app"; visitorId?: string; sessionId?: string };

// ── the API ───────────────────────────────────────────────────────────────────

/** What a caller passes. The tenant is the one the app's own signed-in session attests (plan §9.2). */
export type ServerTrackInput =
  | { name: "feature.used"; tenantId: string; feature: string; count?: number; visitorId?: string; sessionId?: string }
  | { name: "screen.opened"; tenantId: string; route: string; visitorId?: string; sessionId?: string };

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
  track(input: ServerTrackInput, host?: { defer?: Defer }): void;
  /** Send everything buffered now and wait for those sends (retries included). Never rejects. */
  flush(): Promise<FlushResult>;
  stats(): TrackerStats;
}

const SERVER_NAMES: ReadonlySet<string> = new Set(SERVER_EVENT_NAMES);

type Outcome =
  | { kind: "accepted"; refused: number }
  | { kind: "refused"; status: number }
  | { kind: "unavailable"; status: number | null };

/** A key a log line may carry for a schema issue: a schema field name, never input. */
const reasonFor = (issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>): string => {
  const first = issues[0];
  const field = typeof first?.path[0] === "string" ? first.path[0] : "";
  if (field === "feature" && /not registered/.test(first?.message ?? "")) return "unregistered_feature";
  if (field === "route" && /not a registered/.test(first?.message ?? "")) return "unregistered_route";
  return /^[A-Za-z]{1,32}$/.test(field) ? `invalid_${field}` : "invalid_event";
};

const namesOf = (events: readonly ServerEvent[]): string => {
  const n = new Map<string, number>();
  for (const e of events) n.set(e.name, (n.get(e.name) ?? 0) + 1);
  return [...n.entries()].map(([k, v]) => `${k}:${v}`).join(",");
};

/** Classify an answer. Only "unavailable" is retried. */
export function classifyStatus(status: number): "accepted" | "refused" | "unavailable" {
  if (status >= 200 && status < 300) return "accepted";
  if (status === 429 || (status >= 500 && status < 600)) return "unavailable";
  return "refused";
}

export function createTracker(options: TrackerOptions): Tracker {
  const app = options.app;
  const schemas: EventSchemas = options.schemas ?? EVENT_SCHEMAS;
  const log = (line: string): void => {
    try {
      (options.log ?? ((l: string) => console.warn(l)))(line);
    } catch {
      // A throwing logger must not reach the caller either.
    }
  };

  let buffer: ServerEvent[] = [];
  let oldestAt: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = 0;
  const atTrack = new Map<string, number>();
  const pendingDropLog = new Map<string, number>();
  const stats = { accepted: 0, refused: 0, droppedUnavailable: 0, droppedUnconfigured: 0 };

  const countAtTrack = (reason: string): void => {
    atTrack.set(reason, (atTrack.get(reason) ?? 0) + 1);
    pendingDropLog.set(reason, (pendingDropLog.get(reason) ?? 0) + 1);
  };

  /** One line for everything dropped at track() since the last one (reasons and counts only). */
  const logTrackDrops = (): void => {
    if (pendingDropLog.size === 0) return;
    const count = [...pendingDropLog.values()].reduce((a, b) => a + b, 0);
    const reasons = [...pendingDropLog.entries()].map(([k, v]) => `${k}:${v}`).join(",");
    pendingDropLog.clear();
    log(`tracking_events_invalid app=${app} count=${count} reasons=${reasons}`);
  };

  const endpoint = (): string | null => {
    const base = typeof options.engineUrl === "string" ? options.engineUrl.trim().replace(/\/+$/, "") : "";
    return /^https?:\/\/[^\s/]+/.test(base) ? `${base}${SERVER_INTAKE_PATH}` : null;
  };
  const key = (): string | null => {
    try {
      const k = typeof options.apiKey === "function" ? options.apiKey() : options.apiKey;
      return typeof k === "string" && k.trim().length > 0 ? k.trim() : null;
    } catch {
      return null;
    }
  };

  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  async function attemptOnce(url: string, bearer: string, body: string, events: number): Promise<Outcome> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), SEND_TIMEOUT_MS);
    try {
      const doFetch = options.fetch ?? globalThis.fetch;
      const res = await doFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` },
        body,
        signal: ac.signal,
        redirect: "manual",
      });
      const kind = classifyStatus(res.status);
      if (kind === "unavailable") return { kind, status: res.status };
      if (kind === "refused") return { kind, status: res.status };
      if (res.status !== 200) return { kind: "accepted", refused: 0 };
      // 200 = partly refused: `{ stored, refused: [...] }`. An unreadable body counts nothing refused.
      let refused = 0;
      try {
        const parsed = (await res.json()) as { refused?: unknown };
        if (Array.isArray(parsed?.refused)) refused = Math.min(parsed.refused.length, events);
      } catch {
        refused = 0;
      }
      return { kind: "accepted", refused };
    } catch {
      // No answer: a network error, the 2 s timeout, or a throwing fetch.
      return { kind: "unavailable", status: null };
    } finally {
      clearTimeout(t);
    }
  }

  async function sendBatch(events: ServerEvent[]): Promise<FlushResult> {
    inFlight += events.length;
    try {
      const url = endpoint();
      const bearer = key();
      if (url === null || bearer === null) {
        stats.droppedUnconfigured += events.length;
        log(`tracking_events_dropped app=${app} count=${events.length} reason=unconfigured names=${namesOf(events)}`);
        return { accepted: 0, refused: 0, dropped: events.length };
      }
      const body = JSON.stringify({ v: 1, app, batchId: crypto.randomUUID(), events } satisfies ServerBatch);
      let last: Outcome = { kind: "unavailable", status: null };
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]!);
        last = await attemptOnce(url, bearer, body, events.length);
        if (last.kind === "accepted") {
          stats.accepted += events.length - last.refused;
          stats.refused += last.refused;
          if (last.refused > 0) log(`tracking_events_refused app=${app} count=${last.refused} status=200 of=${events.length}`);
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
    } catch {
      // Defensive: nothing above should throw, but a send must never reject.
      stats.droppedUnavailable += events.length;
      log(`tracking_events_dropped app=${app} count=${events.length} reason=internal names=${namesOf(events)}`);
      return { accepted: 0, refused: 0, dropped: events.length };
    } finally {
      inFlight -= events.length;
    }
  }

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  /** Take everything buffered and send it, ≤ 100 events per POST. Never rejects. */
  function sendAll(): Promise<FlushResult> {
    clearTimer();
    logTrackDrops();
    const sends: Promise<FlushResult>[] = [];
    while (buffer.length > 0) sends.push(sendBatch(buffer.splice(0, MAX_BATCH_EVENTS)));
    buffer = [];
    oldestAt = null;
    return Promise.all(sends).then(
      (rs) => rs.reduce((a, r) => ({ accepted: a.accepted + r.accepted, refused: a.refused + r.refused, dropped: a.dropped + r.dropped }), { accepted: 0, refused: 0, dropped: 0 }),
      () => ({ accepted: 0, refused: 0, dropped: 0 }),
    );
  }

  /** Start a send now, handed to the host hook when there is one. */
  const startSend = (defer: Defer | undefined): void => {
    const p = sendAll();
    if (defer) {
      try {
        defer(p);
      } catch {
        // A throwing hook: the send is already running; nothing reaches the caller.
      }
    }
  };

  const armTimer = (): void => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      startSend(options.defer);
    }, FLUSH_INTERVAL_MS);
    const t = timer as unknown as { unref?: () => void };
    if (typeof t.unref === "function") t.unref();
  };

  function build(input: ServerTrackInput): { ok: true; event: ServerEvent } | { ok: false; reason: string } {
    if (input === null || typeof input !== "object") return { ok: false, reason: "invalid_event" };
    const name = input.name;
    if (typeof name !== "string" || !SERVER_NAMES.has(name)) return { ok: false, reason: "not_server_event" };
    const common = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      tenantId: input.tenantId,
      app,
      surface: "in_app" as const,
      // Optional: left out when the caller has none (never a reason to hold the event).
      ...(input.visitorId !== undefined ? { visitorId: input.visitorId } : {}),
      ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
    };
    const candidate =
      input.name === "feature.used"
        ? { name: input.name, ...common, feature: input.feature, count: input.count ?? 1 }
        : { name: input.name, ...common, route: (input as { route: string }).route };
    const r = schemas[name as ServerEventName].safeParse(candidate);
    if (!r.success) return { ok: false, reason: reasonFor(r.error.issues) };
    return { ok: true, event: r.data as ServerEvent };
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
        if (oldestAt === null) oldestAt = now;
        const defer = host?.defer ?? options.defer;
        if (buffer.length >= MAX_BATCH_EVENTS || now - oldestAt >= FLUSH_INTERVAL_MS) startSend(defer);
        else armTimer();
      } catch {
        try {
          countAtTrack("internal_error");
        } catch {
          // Nothing more can be done without risking a throw into the caller.
        }
      }
    },
    flush() {
      try {
        return sendAll();
      } catch {
        return Promise.resolve({ accepted: 0, refused: 0, dropped: 0 });
      }
    },
    stats() {
      return { ...stats, droppedAtTrack: Object.fromEntries(atTrack), buffered: buffer.length, inFlight };
    },
  };
}

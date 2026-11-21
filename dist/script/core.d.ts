/**
 * The page script's logic (plan §4), written against an injected environment so it
 * can be tested with fake timers and a fake DOM. `./index.ts` wires the real browser.
 *
 * It sends only an event's name and its own fields; the edge adds the common fields
 * (§3.1). It never reads a typed value, form data or text content (§3.3 item 3).
 * Nothing awaits, nothing renders, and no failure reaches the page.
 *
 * Transport (§4 Rev 2): an event is sent at the FIRST of
 *   - at once, for `page.view` and `cta.click`;
 *   - 5 s after the oldest unsent event (one timer, cleared whenever the buffer is sent);
 *   - 20 buffered events;
 *   - `visibilitychange` to hidden, or `pagehide` (then by `sendBeacon`).
 * A foreground batch goes by `fetch(…, { keepalive: true })` as text/plain and stays in
 * localStorage (`rt_q`) until the edge answers. The protocol (GD-2740):
 *   - 2xx: stored. 204 = every event stored; 200 = some stored, `x-tracking-refused: <n>` were
 *     refused for good. The batch leaves rt_q.
 *   - 400 / 413 / 422: refused for good (malformed, too large, every event invalid). The batch
 *     leaves rt_q and its events are counted as refused; it is never retried.
 *   - anything else (5xx, 403, 429, a network failure): kept, capped at 200 events and 50 KB of
 *     UTF-8 (oldest out), and retried on the next page load at 1 s, 4 s, 16 s.
 * Every batch carries `b` (random batch id) and `v` (this browser's client visitor id, kept in
 * localStorage `rt_v`). A parked batch keeps both, so a retry has the same identity at the edge
 * whatever happened to cookies, sessions or the date in between (GD-2741).
 * rt_q is validated on every read: anything that isn't a well-formed batch is dropped and
 * counted, never trusted (GD-2739). The counts ride on the next batch as `d` (§5.5).
 */
export type ClientEvent = {
    name: string;
    [k: string]: unknown;
};
export interface Reply {
    ok: boolean;
    status?: number;
    headers?: {
        get(k: string): string | null;
    };
}
export interface Env {
    now(): number;
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(id: unknown): void;
    fetch?: (url: string, init: {
        method: string;
        keepalive: boolean;
        body: string;
        headers: Record<string, string>;
    }) => Promise<Reply>;
    sendBeacon?: (url: string, body: string) => boolean;
    storage?: {
        getItem(k: string): string | null;
        setItem(k: string, v: string): void;
        removeItem(k: string): void;
    };
    random(): string;
    /** `navigator.globalPrivacyControl`; carried on the batch so the edge can set `gpc` (§4, §8). */
    gpc?: boolean;
}
export declare const ENDPOINT = "/t/e";
export declare const FLUSH_MS = 5000;
export declare const MAX_BUFFER = 20;
export declare const QUEUE_KEY = "rt_q";
export declare const VISITOR_KEY = "rt_v";
export declare const QUEUE_MAX_EVENTS = 200;
/** UTF-8 bytes of the stored JSON text of rt_q (GD-2742). */
export declare const QUEUE_MAX_BYTES = 51200;
export declare const RETRY_MS: readonly [1000, 4000, 16000];
/** Statuses that mean "this batch can never be stored": drop it, count it, never retry. */
export declare const TERMINAL: number[];
/** Client-side losses since the last report: m = malformed rt_q entries, r = events the edge refused for good, c = events dropped by the cap. */
export type Drops = {
    m: number;
    r: number;
    c: number;
};
/** UTF-8 byte length of a string (a JSON text has no lone surrogates). */
export declare function utf8Bytes(s: string): number;
export declare function createTransport(env: Env): {
    push: (e: ClientEvent) => void;
    flush: (beacon?: boolean) => void;
    retryParked: (attempt?: number) => void;
    pending: () => number;
    stats: () => {
        malformed: number;
        refused: number;
        capped: number;
    };
};
/** Match a pathname against route templates; each `[param]` matches one non-empty segment (§3.2). */
export declare function matchTemplate(pathname: string, templates: readonly string[]): string | undefined;
//# sourceMappingURL=core.d.ts.map
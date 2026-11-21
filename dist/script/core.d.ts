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
 * localStorage (`rt_q`) until a 2xx; a failed or refused send stays there too, capped at
 * 200 events / 50 KB (oldest out), and is retried on the next page load at 1 s, 4 s, 16 s.
 */
export type ClientEvent = {
    name: string;
    [k: string]: unknown;
};
export interface Env {
    now(): number;
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(id: unknown): void;
    fetch?: (url: string, init: {
        method: string;
        keepalive: boolean;
        body: string;
        headers: Record<string, string>;
    }) => Promise<{
        ok: boolean;
    }>;
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
export declare const QUEUE_MAX_EVENTS = 200;
export declare const QUEUE_MAX_BYTES = 51200;
export declare const RETRY_MS: readonly [1000, 4000, 16000];
export declare function createTransport(env: Env): {
    push: (e: ClientEvent) => void;
    flush: (beacon?: boolean) => void;
    retryParked: (attempt?: number) => void;
    pending: () => number;
};
/** Match a pathname against route templates; each `[param]` matches one non-empty segment (§3.2). */
export declare function matchTemplate(pathname: string, templates: readonly string[]): string | undefined;
//# sourceMappingURL=core.d.ts.map
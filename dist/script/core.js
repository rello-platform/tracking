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
export const ENDPOINT = "/t/e";
export const FLUSH_MS = 5000;
export const MAX_BUFFER = 20;
export const QUEUE_KEY = "rt_q";
export const QUEUE_MAX_EVENTS = 200;
export const QUEUE_MAX_BYTES = 51200;
export const RETRY_MS = [1000, 4000, 16000];
const IMMEDIATE = new Set(["page.view", "cta.click"]);
export function createTransport(env) {
    let buf = [];
    let timer = null;
    const readQ = () => {
        try {
            const v = env.storage?.getItem(QUEUE_KEY);
            const q = v ? JSON.parse(v) : [];
            return Array.isArray(q) ? q : [];
        }
        catch {
            return [];
        }
    };
    const writeQ = (q) => {
        try {
            // Cap by events then bytes, dropping the oldest events first.
            let n = q.reduce((a, x) => a + x.events.length, 0);
            while (q.length && (n > QUEUE_MAX_EVENTS || JSON.stringify(q).length > QUEUE_MAX_BYTES)) {
                const first = q[0];
                first.events.shift();
                n--;
                if (!first.events.length)
                    q.shift();
            }
            if (q.length)
                env.storage?.setItem(QUEUE_KEY, JSON.stringify(q));
            else
                env.storage?.removeItem(QUEUE_KEY);
        }
        catch {
            /* storage full or blocked: the batch is best-effort (§5.5) */
        }
    };
    const park = (batch) => writeQ([...readQ().filter((x) => x.b !== batch.b), batch]);
    const settle = (b) => writeQ(readQ().filter((x) => x.b !== b));
    const post = (batch) => {
        if (!env.fetch)
            return Promise.resolve(false);
        try {
            return env
                .fetch(ENDPOINT, { method: "POST", keepalive: true, body: JSON.stringify(batch), headers: { "content-type": "text/plain" } })
                .then((r) => {
                if (r.ok)
                    settle(batch.b);
                return r.ok;
            })
                .catch(() => false);
        }
        catch {
            return Promise.resolve(false);
        }
    };
    /** Send everything buffered. `beacon` is used on hide / pagehide. */
    const flush = (beacon = false) => {
        if (timer !== null) {
            env.clearTimeout(timer);
            timer = null;
        }
        if (!buf.length)
            return;
        const batch = env.gpc ? { b: env.random(), gpc: true, events: buf } : { b: env.random(), events: buf };
        buf = [];
        if (beacon) {
            let sent = false;
            try {
                sent = !!env.sendBeacon && env.sendBeacon(ENDPOINT, JSON.stringify(batch));
            }
            catch {
                sent = false;
            }
            if (!sent)
                park(batch);
            return;
        }
        park(batch); // kept until a 2xx (§4)
        void post(batch);
    };
    const push = (e) => {
        buf.push(e);
        if (IMMEDIATE.has(e.name) || buf.length >= MAX_BUFFER)
            return flush();
        if (timer === null)
            timer = env.setTimeout(() => flush(), FLUSH_MS);
    };
    /** On page load: retry what an earlier page left in `rt_q`, at 1 s, 4 s, 16 s. */
    // Only the batches an EARLIER page left behind: this page's own batches are in flight.
    let earlier = null;
    const retryParked = (attempt = 0) => {
        if (earlier === null)
            earlier = new Set(readQ().map((x) => x.b));
        if (attempt >= RETRY_MS.length || !earlier.size)
            return;
        env.setTimeout(() => {
            const q = readQ().filter((x) => earlier.has(x.b));
            if (!q.length)
                return;
            void Promise.all(q.map(post)).then((oks) => {
                if (oks.some((ok) => !ok))
                    retryParked(attempt + 1);
            });
        }, RETRY_MS[attempt]);
    };
    return { push, flush, retryParked, pending: () => buf.length };
}
/** Match a pathname against route templates; each `[param]` matches one non-empty segment (§3.2). */
export function matchTemplate(pathname, templates) {
    const parts = pathname === "/" ? [] : pathname.slice(1).split("/");
    for (const t of templates) {
        const tp = t === "/" ? [] : t.slice(1).split("/");
        if (tp.length === parts.length && tp.every((s, i) => (s[0] === "[" ? parts[i] !== "" : s === parts[i])))
            return t;
    }
    return undefined;
}

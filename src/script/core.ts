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

export type ClientEvent = { name: string; [k: string]: unknown };

export interface Reply {
  ok: boolean;
  status?: number;
  headers?: { get(k: string): string | null };
}

export interface Env {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  fetch?: (url: string, init: { method: string; keepalive: boolean; body: string; headers: Record<string, string> }) => Promise<Reply>;
  sendBeacon?: (url: string, body: string) => boolean;
  storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
  random(): string;
  /** `navigator.globalPrivacyControl`; carried on the batch so the edge can set `gpc` (§4, §8). */
  gpc?: boolean;
}

export const ENDPOINT = "/t/e";
export const FLUSH_MS = 5000;
export const MAX_BUFFER = 20;
export const QUEUE_KEY = "rt_q";
export const VISITOR_KEY = "rt_v";
export const QUEUE_MAX_EVENTS = 200;
/** UTF-8 bytes of the stored JSON text of rt_q (GD-2742). */
export const QUEUE_MAX_BYTES = 51200;
export const RETRY_MS = [1000, 4000, 16000] as const;
/** Statuses that mean "this batch can never be stored": drop it, count it, never retry. */
export const TERMINAL = [400, 413, 422];
const IMMEDIATE = new Set(["page.view", "cta.click"]);
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const VID = /^[A-Za-z0-9_-]{16,64}$/;

/** Client-side losses since the last report: m = malformed rt_q entries, r = events the edge refused for good, c = events dropped by the cap. */
export type Drops = { m: number; r: number; c: number };

/**
 * `b` is a random batch id and `v` the client visitor id: the edge derives the batch identity
 * from tenant + v + b, so a batch re-sent after an unknown outcome is stored once (§5.3).
 */
type Batch = { b: string; v: string; gpc?: true; d?: Drops; events: ClientEvent[] };

/** UTF-8 byte length of a string (a JSON text has no lone surrogates). */
export function utf8Bytes(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c < 0xdc00) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

export function createTransport(env: Env) {
  let buf: ClientEvent[] = [];
  let timer: unknown = null;
  const lost: Drops = { m: 0, r: 0, c: 0 };
  const unsent: Drops = { m: 0, r: 0, c: 0 };
  const count = (k: keyof Drops, n: number): void => {
    lost[k] += n;
    unsent[k] += n;
  };

  // The client visitor id: kept in rt_v; per page when storage is unavailable.
  let vid = "";
  const visitor = (): string => {
    if (vid) return vid;
    try {
      const got = env.storage?.getItem(VISITOR_KEY);
      if (got && VID.test(got)) return (vid = got);
    } catch {
      /* storage blocked: an in-memory id for this page */
    }
    let fresh = "";
    try {
      fresh = String(env.random()).replace(/[^A-Za-z0-9_-]/g, "");
    } catch {
      fresh = "";
    }
    while (fresh.length < 22) fresh += Math.random().toString(36).slice(2);
    vid = fresh.slice(0, 32);
    try {
      env.storage?.setItem(VISITOR_KEY, vid);
    } catch {
      /* best-effort */
    }
    return vid;
  };

  /** One stored batch, validated: a well-formed copy, or null. Bad events inside it are dropped one by one. */
  const clean = (x: unknown): Batch | null => {
    const o = x as Partial<Batch> | null;
    if (!o || typeof o !== "object" || Array.isArray(o) || typeof o.b !== "string" || !ID.test(o.b) || typeof o.v !== "string" || !VID.test(o.v) || !Array.isArray(o.events)) {
      count("m", 1);
      return null;
    }
    const events = o.events.filter((e): e is ClientEvent => {
      const ok = !!e && typeof e === "object" && !Array.isArray(e) && typeof (e as ClientEvent).name === "string" && (e as ClientEvent).name.length <= 64;
      if (!ok) count("m", 1);
      return ok;
    });
    if (!events.length) return null;
    const out: Batch = { b: o.b, v: o.v, events };
    if (o.gpc === true) out.gpc = true;
    if (o.d && typeof o.d === "object") out.d = { m: +o.d.m || 0, r: +o.d.r || 0, c: +o.d.c || 0 };
    return out;
  };

  const readQ = (): Batch[] => {
    let parsed: unknown;
    try {
      const v = env.storage?.getItem(QUEUE_KEY);
      if (!v) return [];
      parsed = JSON.parse(v);
    } catch {
      // Unreadable text: drop it so it can't break every later read.
      count("m", 1);
      try {
        env.storage?.removeItem(QUEUE_KEY);
      } catch {
        /* blocked */
      }
      return [];
    }
    if (!Array.isArray(parsed)) {
      count("m", 1);
      return [];
    }
    const out: Batch[] = [];
    let dirty = false;
    for (const x of parsed) {
      const c = clean(x);
      if (c) out.push(c);
      if (!c || c.events.length !== (x as Batch).events.length) dirty = true;
    }
    if (dirty) writeQ(out.slice()); // store the cleaned queue, so each bad entry is dropped and counted once
    return out;
  };
  const writeQ = (q: Batch[]): void => {
    try {
      // Cap by events then UTF-8 bytes, dropping the oldest events first.
      let n = q.reduce((a, x) => a + x.events.length, 0);
      let size = utf8Bytes(JSON.stringify(q));
      while (q.length && (n > QUEUE_MAX_EVENTS || size > QUEUE_MAX_BYTES)) {
        const first = q[0]!;
        const e = first.events.shift();
        n--;
        count("c", 1);
        if (!first.events.length) {
          q.shift();
          size = utf8Bytes(JSON.stringify(q));
        } else size -= utf8Bytes(JSON.stringify(e)) + 1; // the event and its comma
      }
      if (q.length) env.storage?.setItem(QUEUE_KEY, JSON.stringify(q));
      else env.storage?.removeItem(QUEUE_KEY);
    } catch {
      /* storage full or blocked: the batch is best-effort (§5.5) */
    }
  };
  const settle = (b: string): void => writeQ(readQ().filter((x) => x.b !== b));

  /** Resolves true once the batch is done with (stored or refused for good), false when it should be retried. */
  const post = (batch: Batch): Promise<boolean> => {
    try {
      if (!env.fetch) return Promise.resolve(false);
      return env
        .fetch(ENDPOINT, { method: "POST", keepalive: true, body: JSON.stringify(batch), headers: { "content-type": "text/plain" } })
        .then((r) => {
          if (r.ok) {
            count("r", Math.max(0, Math.min(batch.events.length, Number(r.headers?.get("x-tracking-refused")) || 0)));
            settle(batch.b);
            return true;
          }
          if (TERMINAL.includes(Number(r.status))) {
            count("r", batch.events.length);
            settle(batch.b);
            return true;
          }
          return false;
        })
        .catch(() => false);
    } catch {
      return Promise.resolve(false);
    }
  };

  /** Send everything buffered. `beacon` is used on hide / pagehide. Never throws. */
  const flush = (beacon = false): void => {
    try {
      if (timer !== null) {
        env.clearTimeout(timer);
        timer = null;
      }
      if (!buf.length) return;
      const parked = readQ(); // first, so what this read drops is counted on THIS batch's d
      const batch: Batch = { b: String(env.random()).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || Date.now().toString(36), v: visitor(), events: buf };
      if (env.gpc) batch.gpc = true;
      if (unsent.m || unsent.r || unsent.c) {
        batch.d = { m: unsent.m, r: unsent.r, c: unsent.c };
        unsent.m = unsent.r = unsent.c = 0;
      }
      buf = [];
      if (beacon) {
        let sent = false;
        try {
          sent = !!env.sendBeacon && env.sendBeacon(ENDPOINT, JSON.stringify(batch));
        } catch {
          sent = false;
        }
        if (!sent) writeQ([...parked, batch]);
        return;
      }
      writeQ([...parked, batch]); // kept until the edge answers (§4)
      void post(batch);
    } catch {
      /* the page never knows */
    }
  };

  const push = (e: ClientEvent): void => {
    try {
      buf.push(e);
      if (IMMEDIATE.has(e.name) || buf.length >= MAX_BUFFER) return flush();
      if (timer === null) timer = env.setTimeout(() => flush(), FLUSH_MS);
    } catch {
      /* the page never knows */
    }
  };

  /** On page load: retry what an earlier page left in `rt_q`, at 1 s, 4 s, 16 s. */
  // Only the batches an EARLIER page left behind: this page's own batches are in flight.
  let earlier: Set<string> | null = null;
  const retryParked = (attempt = 0): void => {
    try {
      if (earlier === null) earlier = new Set(readQ().map((x) => x.b));
      if (attempt >= RETRY_MS.length || !earlier.size) return;
      env.setTimeout(() => {
        try {
          const q = readQ().filter((x) => earlier!.has(x.b));
          if (!q.length) return;
          void Promise.all(q.map(post)).then((oks) => {
            if (oks.some((ok) => !ok)) retryParked(attempt + 1);
          });
        } catch {
          /* the page never knows */
        }
      }, RETRY_MS[attempt]!);
    } catch {
      /* the page never knows */
    }
  };

  return { push, flush, retryParked, pending: () => buf.length, stats: () => ({ malformed: lost.m, refused: lost.r, capped: lost.c }) };
}

/** Match a pathname against route templates; each `[param]` matches one non-empty segment (§3.2). */
export function matchTemplate(pathname: string, templates: readonly string[]): string | undefined {
  const parts = pathname === "/" ? [] : pathname.slice(1).split("/");
  for (const t of templates) {
    const tp = t === "/" ? [] : t.slice(1).split("/");
    if (tp.length === parts.length && tp.every((s, i) => (s[0] === "[" ? parts[i] !== "" : s === parts[i]))) return t;
  }
  return undefined;
}

/**
 * The `/t/c` redirect (plan §2.4, Rev 3 GD-2706). A pure function of the URL: no engine,
 * Queue, KV or Rello call is on its path, so the engine Worker, an origin fallback
 * route and an app with no zone route all give the same 302 from the same code.
 *
 * `/t/c/<path>?<query>&rg=…&r=…` → `/<path>?<query>`: only `rg` and `r` are removed and
 * every other query parameter is kept, so an open redirect is impossible by construction.
 *
 * REJECTION RULE (GD-2743). The destination is the path after `/t/c`, percent-decoded once.
 * It is rejected when the decoded path contains `//` anywhere (leading or internal, written
 * or `%2F`-encoded), a backslash, a control character or a scheme-shaped first segment, or
 * when it can't be decoded. A rejected destination goes to bare `/` with NO query: nothing
 * from a malformed or hostile link is carried. A URL outside `/t/c`, or one that can't be
 * parsed, also goes to bare `/`. An accepted path is kept exactly as written (still encoded).
 * Dot segments never reach the check: the URL parser resolves them first (`%2e%2e` included),
 * so `/t/c/../x` is outside `/t/c`.
 */
export const REDIRECT_PREFIX = "/t/c";
const STRIPPED = new Set(["rg", "r"]);
/** The Location for a `/t/c` request URL. Always a same-host path starting with a single "/". */
export function redirectLocation(requestUrl) {
    let url;
    try {
        url = typeof requestUrl === "string" ? new URL(requestUrl) : requestUrl;
    }
    catch {
        return "/";
    }
    const raw = url.pathname;
    if (raw !== REDIRECT_PREFIX && !raw.startsWith(REDIRECT_PREFIX + "/"))
        return "/";
    const rest = raw.slice(REDIRECT_PREFIX.length) || "/";
    let decoded;
    try {
        decoded = decodeURIComponent(rest);
    }
    catch {
        return "/";
    }
    // Same-host path only: no "//" anywhere, no "\\", no scheme, no control characters.
    if (!rest.startsWith("/") || decoded.includes("//") || decoded.includes("\\") || /^\/+[a-z][a-z0-9+.-]*:/i.test(decoded) || /[\u0000-\u001f\u007f]/.test(decoded)) {
        return "/";
    }
    const kept = new URLSearchParams();
    for (const [k, v] of url.searchParams)
        if (!STRIPPED.has(k))
            kept.append(k, v);
    const q = kept.toString();
    return q ? `${rest}?${q}` : rest;
}
/** The campaign id and token a `/t/c` URL carries, for the engine to record (never used to build the Location). */
export function redirectAttribution(requestUrl) {
    try {
        const url = typeof requestUrl === "string" ? new URL(requestUrl) : requestUrl;
        const rg = url.searchParams.get("rg") ?? undefined;
        const r = url.searchParams.get("r") ?? undefined;
        return { ...(rg ? { rg } : {}), ...(r ? { r } : {}) };
    }
    catch {
        return {};
    }
}

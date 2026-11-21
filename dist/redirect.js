/**
 * The `/t/c` redirect (plan §2.4, Rev 3 GD-2706). A pure function of the URL: no engine,
 * Queue, KV or Rello call is on its path, so the engine Worker, an origin fallback
 * route and an app with no zone route all give the same 302 from the same code.
 *
 * `/t/c/<path>?<query>&rg=…&r=…` → `/<path>?<query>`: only `rg` and `r` are removed,
 * every other query parameter is kept, and anything that is not a same-host path
 * goes to `/`, so an open redirect is impossible by construction.
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
    let rest = raw.slice(REDIRECT_PREFIX.length) || "/";
    let decoded;
    try {
        decoded = decodeURIComponent(rest);
    }
    catch {
        return "/";
    }
    // Same-host only: no scheme, no "//" or "\" (protocol-relative), no control characters.
    if (!rest.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\") || /^\/+[a-z][a-z0-9+.-]*:/i.test(decoded) || /[\u0000-\u001f\u007f]/.test(decoded)) {
        rest = "/";
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

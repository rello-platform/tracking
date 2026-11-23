/**
 * The `/t/c` redirect (plan §2.4, Rev 3 GD-2706). A pure function of the URL: no engine,
 * Queue, KV or Rello call is on its path, so the engine Worker, an origin fallback
 * route and an app with no zone route all give the same 302 from the same code.
 *
 * `/t/c/<path>?<query>&rg=…&r=…` → `/<path>?<query>`: `rg`, `r` and the four ad-click keys
 * (`gclid`, `gbraid`, `wbraid`, `fbclid`; S12 design §5.1, which the edge records from this URL) are
 * removed and every other query parameter is kept, so an open redirect is impossible by
 * construction and a click id never reaches a canonical URL or a cache.
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
export declare const REDIRECT_PREFIX = "/t/c";
/** The Location for a `/t/c` request URL. Always a same-host path starting with a single "/". */
export declare function redirectLocation(requestUrl: string | URL): string;
/** The campaign id and token a `/t/c` URL carries, for the engine to record (never used to build the Location). */
export declare function redirectAttribution(requestUrl: string | URL): {
    rg?: string;
    r?: string;
};
//# sourceMappingURL=redirect.d.ts.map
/**
 * The `/t/c` redirect (plan §2.4, Rev 3 GD-2706). A pure function of the URL: no engine,
 * Queue, KV or Rello call is on its path, so the engine Worker, an origin fallback
 * route and an app with no zone route all give the same 302 from the same code.
 *
 * `/t/c/<path>?<query>&rg=…&r=…` → `/<path>?<query>`: only `rg` and `r` are removed,
 * every other query parameter is kept, and anything that is not a same-host path
 * goes to `/`, so an open redirect is impossible by construction.
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
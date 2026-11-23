# @rello-platform/tracking

The platform tracking vocabulary (PLATFORM-TRACKING-SYSTEM, slice S1). Every later
slice imports it: the Tracking Engine's edge and consumer, Rello, and each app's
in-app sender.

```
npm install "@rello-platform/tracking@github:rello-platform/tracking#v0.3.1"
```

## What is in it

| Export | What it is |
|---|---|
| `EVENT_NAMES`, `EVENT_SCHEMAS`, `parseEvent` | The 12 stored events (`link.hit`, `link.scanned`, `visit.start`, `page.view`, `page.leave`, `scroll.depth`, `section.read`, `cta.click`, `widget.use`, `identify`, `screen.opened`, `feature.used`). Each is a zod `.strict()` object; the event name is in `name`. Common fields are filled in by the edge or app server, never by a browser. |
| `ROUTES[app]`, `matchRoute` | Registered route templates. `screen.opened.route`, and `path` on `spoke_public`/`in_app`, must be one of the event's app's templates. |
| `FEATURES[app]` | Registered `feature.used` keys. An app's `feature.used` is refused unless its key is registered here in a reviewed release. v0.3.0 registers Rello's first eleven (S9 part 3); every other app registers none yet. |
| `findUnboundedStrings`, `findNonStrictObjects` | Guards: the package test runs them over all 12 schemas and requires an empty list. |
| `checkScriptSize`, `SCRIPT_GZIP_LIMIT_BYTES` | The page script must be ≤ 3,072 B minified + gzipped (level 9). |
| `@rello-platform/tracking/redirect` | `redirectLocation(url)`: the pure `/t/c` 302. It removes `rg`, `r` and the four ad-click keys (`gclid`, `gbraid`, `wbraid`, `fbclid`, S12 §5.1) and keeps the rest of the query. A rejected destination goes to bare `/` (rule below). |
| `CLIENT_EVENT_NAMES`, `CLIENT_EVENT_SCHEMAS`, `parseClientEvent` | S12b: the two client events the page script sends and the edge transforms (not stored events): `landing.adclick {pageId, params}` (the four ad-click keys, 1–4, unique) and `ads.decision {pageId, reason}`. `.strict()`, every string bounded. |
| `AD_CLICK_KEYS`, `AD_CLICK_VALUE`, `adClickParams` | S12 §5.1: the only query keys read for ad attribution, their value shape (`[A-Za-z0-9._-]{8,512}`), and the one reader (a bad value drops that key alone). |
| `ADS_REASONS`, `ADS_VENDORS`, `RTK_LETTERS`, `RTK_RESERVED_LETTERS`, `ADS_LOADER_PATH` | S12b constants: the loader's reasons in precedence order; the reviewed extra-vendor list (empty); the `rtk_<letter>_` cookie letters (`t`, `c`, `p`; `f` reserved for T4); `/t/a.v1.js`. |
| `adsLoaderScript`, `adsNoTagScript`, `ADS_LOADER_GZIP_LIMIT_BYTES`, `ADS_VENDOR_HOSTNAMES` | S12b: the body of `/t/a.v1.js` (≤ 2 KB gzip). The engine decides per request whether to serve it; the package owns what it serves. Every id is checked before it is written, so a config value can never become code. |
| `@rello-platform/tracking/script` | The built page script (`dist/script/s.js`), served by the engine at `/t/s.v<major>.<minor>.js`. |

Registry keys are the canonical app slugs from `@rello-platform/slugs`. Each registry
is an exhaustive mapped type over `AppSlug`, so a non-canonical key fails to compile.

## Registering a route or a feature

Add it to `src/registry.ts`, bump the minor version, rebuild, commit `dist/`, tag.
A route template may use only lowercase static words (no digits) and
`[camelCaseParam]` segments; the grammar test refuses a concrete value. The grammar is
not the protection. Membership in a reviewed release is.

Both matchers return the **first** template that matches, so a static template is listed
before a `[param]` template of the same shape (`/c/dashboard` before `/c/[token]`); a test
checks every static template matches itself. v0.1.2 registers Rello's S10 public pages:
`/rate-check/[slug]`, `/growth/interest/[token]`, `/signup-link/[token]` and `/c/dashboard`.

## The page script

```html
<script defer src="/t/s.v1.0.js" data-surface="marketing"></script>
<!-- spoke_public / in_app: the path sent is the matched template, never the URL -->
<script defer src="/t/s.v1.0.js" data-surface="spoke_public" data-routes="/c/[token] /d/[token]"></script>
```

It sends `page.view` at once, and a `cta.click` at once. Anything else goes 5 s after the
oldest unsent event, at 20 events, or on hide (by `sendBeacon`). It reads only `data-*`
attributes (plus the path, the published page's title and page-type meta, and a CTA's
destination host), never a typed value, and nothing on the page waits for it.

**On `spoke_public` it sends only `page.view` (GD-3035, plan §3.3 item 4).** Pages a tenant's
clients use (portals, `/c/[token]`, `/d/[token]`) get a `page.view` on load and on an in-page
route change, and nothing else: the script installs no scroll, `[data-section]`, click or
`pagehide` listener on that surface. Every other surface is unchanged.

**It never throws into the page (v0.1.1, GD-2739).** Every callback it installs is guarded,
and `rt_q` is validated on every read: anything that is not a well-formed batch is dropped and
counted, never trusted. It wraps `history.pushState` / `replaceState` (a `replaceState` counts as
a view only when the path changes); the native call runs first and unguarded, so an error the
browser throws there reaches the page's caller unchanged.

**The protocol with the edge (`POST /t/e`, v0.1.1, GD-2740/2741).** A batch is
`{ b, v, gpc?, d?, events }`: `b` a random batch id, `v` this browser's client visitor id (kept
in `localStorage` `rt_v`), `d` the client's loss counts since its last report
(`m` malformed rt_q entries, `r` events refused by the edge, `c` events dropped by the cap).
A foreground batch stays in `rt_q` until the edge answers:

| Answer | Means | The script |
|---|---|---|
| 204 | every event stored | drops the batch from `rt_q` |
| 200 + `x-tracking-refused: n` | the valid events stored, `n` refused | drops it, counts `n` refused |
| 400 / 413 / 422 | can never be stored (malformed, too large, every event invalid) | drops it, counts its events refused, never retries |
| anything else (5xx, 403, 429, network) | not stored | keeps it, retries on the next page load at 1 s, 4 s, 16 s |

A parked batch keeps its `b` and `v`, so a retry has the same identity at the edge whatever
happened to cookies, the session or the date. `rt_q` is capped at 200 events and 51,200 bytes of
UTF-8 (the stored JSON text), oldest out.

## The server sender (v0.2.0, S9)

```ts
import { createTracker } from "@rello-platform/tracking/server";

const tracker = createTracker({
  app: "rello",
  engineUrl: process.env.TRACKING_ENGINE_URL,      // missing → nothing sent, one counted line
  apiKey: () => process.env.TRACKING_ENGINE_API_KEY, // <APP> → TRACKING_ENGINE, tracking:write
});

// In a route handler: returns at once, never throws. `tenantId` is the signed-in session's tenant.
tracker.track({ name: "feature.used", tenantId, feature: "leads.create" }, { defer: after });
tracker.track({ name: "screen.opened", tenantId, route: "/leads/[id]" });
```

| Rule (plan §5.5 L5) | Behaviour |
|---|---|
| Validation | `EVENT_SCHEMAS` + `FEATURES` / `ROUTES`. An unregistered feature or route is dropped and counted, never sent. |
| Batching | In-process buffer; a send every ≤ 10 s, or at once at 100 events. ≤ 100 events per `POST <engine>/v1/events`. |
| Timeout and retry | 2 s per attempt. Retried only when unavailable (no answer, timeout, 429, 5xx, or a 200 whose body can't be read or isn't exactly the partial answer below): at 2 s, 10 s and 30 s, always the same batchId and event ids. A refusal (other 4xx) is never retried. |
| Partial answer | 200 with exactly `{ stored, refused: [{ i, reason }] }` and no other key: `stored` a non-negative integer, `refused` non-empty, each `i` a distinct integer in `0 ≤ i < events`, each `reason` a non-empty string, and `stored + refused.length = events`. Then `refused.length` is counted refused, the rest accepted, no retry. Any other 200 body is unavailable. |
| Drop | After the 4th attempt: one line `tracking_events_dropped app=<slug> count=<n> reason=unavailable attempts=4 …`. |
| Logs | App, event names, counts, reasons and statuses only, never a field value. |
| Host hook | `track(e, { defer })`: Next.js `after`, or a Worker's `ctx.waitUntil` (pass it per call: a ctx is per request). Every call hands `defer` a promise: the send it starts, or, if it only buffered, the 10 s timed send. So one event on a Worker with no later request is still sent at 10 s. On a Worker, `waitUntil` lasts 30 s after the response; a timed send that also needs retries can outlast it (10 s + up to ~38 s of attempts), and the cut-off retries end without a drop line. |
| Losses | A process that dies loses its buffer without a line (L5). Nothing is written to the hub. |

It runs on Node ≥ 19 and Cloudflare Workers (`fetch`, `AbortController`, `setTimeout`, `crypto.randomUUID`).
`feature.used` and `screen.opened` carry no edge facts from a server: `visitorId`, `sessionId`, `country`,
`region`, `deviceClass`, `ipHash` and `gpc` are optional on those two events only (pass the browser's
`visitorId` / `sessionId` when the app has them).

## The `/t/c` rejection rule (v0.1.1, GD-2743)

The destination is the path after `/t/c`, percent-decoded once. It is **rejected** when the
decoded path contains `//` anywhere (leading or internal, written or `%2F`-encoded), a
backslash, a control character or a scheme-shaped first segment, or when it can't be decoded.
A rejected destination goes to **bare `/` with no query**. A URL outside `/t/c`, or one that
can't be parsed, also goes to bare `/`. An accepted path is kept exactly as written, with every
query parameter except `rg` and `r`. Dot segments are resolved by the URL parser before the
check (`%2e%2e` included), so they can't climb out of `/t/c`.

## Build and release

`npm test` compiles (tsc + `scripts/build-script.mjs`), typechecks the tests, and runs
vitest. `dist/` is committed because consumers install from git tags; the pre-push
`tag-dist-gate` refuses a `v*` tag whose `dist/` does not reproduce from `src/`.
There is no GitHub Actions workflow in this repo, by design: `.husky/pre-push` is the
gate.

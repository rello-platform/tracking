# @rello-platform/tracking

The platform tracking vocabulary (PLATFORM-TRACKING-SYSTEM, slice S1). Every later
slice imports it: the Tracking Engine's edge and consumer, Rello, and each app's
in-app sender.

```
npm install "@rello-platform/tracking@github:rello-platform/tracking#v0.1.0"
```

## What is in it

| Export | What it is |
|---|---|
| `EVENT_NAMES`, `EVENT_SCHEMAS`, `parseEvent` | The 12 stored events (`link.hit`, `link.scanned`, `visit.start`, `page.view`, `page.leave`, `scroll.depth`, `section.read`, `cta.click`, `widget.use`, `identify`, `screen.opened`, `feature.used`). Each is a zod `.strict()` object; the event name is in `name`. Common fields are filled in by the edge or app server, never by a browser. |
| `ROUTES[app]`, `matchRoute` | Registered route templates. `screen.opened.route`, and `path` on `spoke_public`/`in_app`, must be one of the event's app's templates. |
| `FEATURES[app]` | Registered `feature.used` keys. v0.1.0 registers none, so every `feature.used` is refused until an app registers its features in a reviewed release. |
| `findUnboundedStrings`, `findNonStrictObjects` | Guards: the package test runs them over all 12 schemas and requires an empty list. |
| `checkScriptSize`, `SCRIPT_GZIP_LIMIT_BYTES` | The page script must be ≤ 3,072 B minified + gzipped (level 9). |
| `@rello-platform/tracking/redirect` | `redirectLocation(url)`: the pure `/t/c` 302. It removes only `rg` and `r`, keeps the rest of the query, and sends anything that is not a same-host path to `/`. |
| `@rello-platform/tracking/script` | The built page script (`dist/script/s.js`), served by the engine at `/t/s.v<major>.<minor>.js`. |

Registry keys are the canonical app slugs from `@rello-platform/slugs`. Each registry
is an exhaustive mapped type over `AppSlug`, so a non-canonical key fails to compile.

## Registering a route or a feature

Add it to `src/registry.ts`, bump the minor version, rebuild, commit `dist/`, tag.
A route template may use only lowercase static words (no digits) and
`[camelCaseParam]` segments; the grammar test refuses a concrete value. The grammar is
not the protection. Membership in a reviewed release is.

## The page script

```html
<script defer src="/t/s.v1.0.js" data-surface="marketing"></script>
<!-- spoke_public / in_app: the path sent is the matched template, never the URL -->
<script defer src="/t/s.v1.0.js" data-surface="spoke_public" data-routes="/c/[token] /d/[token]"></script>
```

It sends `page.view` at once, and a `cta.click` at once. Anything else goes 5 s after the
oldest unsent event, at 20 events, or on hide (by `sendBeacon`). Foreground batches
go by `fetch` with `keepalive` and stay in `localStorage` (`rt_q`) until a 2xx;
failures are retried on the next page load at 1 s, 4 s and 16 s. It reads only
`data-*` attributes, never a typed value, and nothing on the page waits for it.

## Build and release

`npm test` compiles (tsc + `scripts/build-script.mjs`), typechecks the tests, and runs
vitest. `dist/` is committed because consumers install from git tags; the pre-push
`tag-dist-gate` refuses a `v*` tag whose `dist/` does not reproduce from `src/`.
There is no GitHub Actions workflow in this repo, by design: `.husky/pre-push` is the
gate.

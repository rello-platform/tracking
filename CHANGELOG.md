# Changelog

## v0.9.0 — 2026-11-28 (HOME INSIGHT HI-04: six Rello screen names, spec RELLO-HOME-INSIGHT §9 HI-04, seam X-29)

Registry only. `ROUTES.rello` gains the six screen names Rello will send as `screen.opened` for Home Insight (HI-52,
HI-57, HI-61), so the intake stores them instead of refusing them as unregistered:

- `/` (the dashboard) and `/today`.
- `/leads/home-insight`, `/team/realtor-prospects` and `/team/performance`. Team and Leads switch tabs with `?tab=`
  (Rello `team/page.tsx:21,41`), and a query is never a route, so each Home Insight tab gets its own name.
- `/agent/sponsored`, sent only after Rello's server confirms the viewer holds an ACTIVE `HomeInsightSponsorship`
  (H-8). `/agent` itself stays unregistered.

Five are appended after the v0.8.0 list. **`/leads/home-insight` goes just before `/leads/[id]`, not at the end**: both
matchers return the first template that matches, so after `/leads/[id]` it could never match itself
(`tests/registry-rello-s10.test.ts` checks that for every app). A lead id is a cuid, never this word, so no lead page
is renamed. This is the one v0.8.0 position that moves: every v0.8.0 entry keeps its relative order.

- **Unchanged:** every other app's `ROUTES`, every app's `FEATURES` (both pinned by hash in the new test), the event
  schemas, the page script (`dist/script/s.js`, same bytes), the server helper, the redirect and the ads loader.
- **Side effect, by design of a per-app list:** an `in_app` browser path of `/` or `/today` on Rello is now stored as
  that template instead of with no path (`tracking_path_unregistered`).
- Tests: `tests/registry-rello-home-insight-v090.test.ts` (new). Three older pins now take the six names out before
  comparing: `registry-rello-s9` (its v0.1.x + S10 + S9 order), `registry-rello-s10` (the length, 16 → 22) and
  `registry-spokes-s10-v080` (rello's v0.7.0 hash).

## v0.8.0 — 2026-11-25 (S10 prep for U16–U18: spoke page templates, Platform KA prompt 2022; ruling KA 2020)

Registry only. `ROUTES` gains the page templates the S10 spoke tags will send on `spoke_public`, so a `page.view` from
those pages is stored with its template (the engine stores an unmatched path as no path, `tracking_path_unregistered`).
Each list is made from that repo's main by one rule (written beside each list in `src/registry.ts`):

- **home-scout**, 34 added (13 → 47). Every `page.tsx` under `src/app/(public)/[agentSlug]/**` and
  `src/app/(owner)/[agentSlug]/**` at The-Home-Scout `fcbb6ee0`: route groups dropped, the leading `[agentSlug]` dropped
  (the agent is the host label), other `[param]`s kept, `(product)/page.tsx` = `/`. Left out: `[pageSlug]/preview` (the
  agent's drafts) and `/embed/**`. The agent site's `/tools` is the `/tools` already registered (35 pages, 34 new).
- **home-ready**, 4 added (17 → 21). `/` and `/login`: the landing pages the subdomain branch of HomeReady's
  `src/middleware.ts` rewrites to (`/landing/[slug]` dropped), at `4c97a28d`; plus `/portal/[leadId]` and
  `/results/[leadId]` (STATUS U18, template only).
- **home-stretch**, 28 added (6 → 34). Every `page.tsx` under `src/app/portal/` at TheHomeStretch `4d95dd3b`.

All 66 fit `ROUTE_TEMPLATE_GRAMMAR`; none was left out for the grammar. Statics come before the `[param]` template of the
same depth (both matchers return the first match). Every v0.7.0 entry of every app is unchanged and first.

- **Unchanged:** the event schemas, `FEATURES`, the page script (`dist/script/s.js`, same bytes), the server helper, the
  redirect and the ads loader.
- **Known overlaps (by design of a per-app list):** `ROUTES` is per app, not per surface, so `/[pageSlug]` also matches a
  one-segment Home Scout path no earlier template matches; HomeReady's `/portal/verify` is not registered, so a
  `page.view` there would match `/portal/[leadId]`. Both carry no person value.
- Tests: `tests/registry-spokes-s10-v080.test.ts` (new). `tests/registry-spokes-v050.test.ts` now pins each app's v0.5.0
  entries as the first n of its list, as the v0.6.0 upsell change did for FEATURES.

## v0.7.0 — 2026-11-25 (U23b: an optional caller event id on the server `track()`, Platform KA prompt 1966; ruling KA 1943)

Server helper only. `ServerTrackInput` (both `feature.used` and `screen.opened`) gains an optional `id?: string`. When a
caller passes one, the event goes out under that id instead of a minted one; without one, `build()` mints a v4 UUID per event
exactly as before. The upsell dual-writes (U23 PathfinderPro, U24–U30 the other seven source apps) need it: the engine event
must carry the id the hub `AuditLog` row already holds, so the overlap week can match the two stores id for id. Until now
PathfinderPro did that with a one-event fetch-layer rewrite after the package's validation; this replaces that pattern.

- **Validation is the event schema's own.** The caller's id is put on the candidate event and checked by `EVENT_SCHEMAS[name]`
  (`id: z.uuid()`) with every other field, at `track()`, before anything is buffered. A supplied id that is not a UUID fails
  that check and is refused the way every invalid field already is (`build()` returns not-ok; `track()` drops the event and
  counts it): `stats().droppedAtTrack.invalid_id` goes up and the next send's `tracking_events_invalid` line counts
  `reasons=invalid_id:<n>`. It is never sent, never replaced by a minted id, and its value is never in a log line.
- **Only `undefined` means "no id".** A `null` or any other non-string is the caller's id and is refused by the same check;
  it is never treated as absent.
- **Retries keep it.** The id is fixed when the event is buffered, so every attempt of a batch carries the same caller id
  (the engine dedupes by id).
- **Unchanged:** the wire contract and `SERVER_BATCH_SCHEMA`, batching, timers, the 2 s timeout, the retry schedule,
  `classifyStatus` / `partialRefusedCount`, log line formats, `FEATURES` and `ROUTES` (0 changes), the event schemas, the
  page script (`dist/script/s.js`, same bytes, 7214 B), the redirect and the ads loader.
- Tests: `tests/server-caller-id.test.ts` (a caller id on the wire for both events; no id → a fresh UUID per event; nine
  non-UUID ids refused at track() and nothing sent; a bad id beside a good event; `undefined` is no id; the id on all three
  attempts of a 503, 503, 204 retry). `tests/server.test.ts` is unchanged.
- No tag is cut by this change; `v0.7.0` is tagged after the audit.

## v0.6.0 — 2026-11-24 (U21: the upsell feature keys, Platform KA prompts 1884 and 1885; plan marker S11B-KA1881)

Registry only. `FEATURES[app]` gains the `upsell.<surface>.<event>` keys of the eight apps that sell Rello an upgrade:
slice S11 sends a spoke's upsell telemetry (today the hub `AuditLog` PlatformSignal rows named
`<app>.upsell.<surface>.<event>`) to the engine as `feature.used` with `feature = "upsell.<surface>.<event>"`, and the engine
refuses a feature its pinned registry does not list. Growth's engine read turns (app, feature) back into the hub name by
putting `<app>.` in front, so the mapping is exact and lossless in both directions (pinned by a round-trip test). The v0.5.0
entries are byte for byte unchanged and stay in front (checked against the `v0.5.0` tag); `ROUTES`, the event schemas,
the page script (`dist/script/s.js`, same bytes, 7214 B), the server helper, the redirect, the wire contract and the
grammar are unchanged. No tag is cut by this change.

The vocabulary (KA 1885): every `<surface>.<event>` pair a source app emits on its main today, every pair Rello writes under
a source app's family (trial-start's `converted`), and the 25 seams × 5 events. `@rello-platform/signals` v0.41.0 registers only
the prefix `<app>.upsell.`, and Growth's interest read counts any surface's `.clicked` plus `upgrade-page.shown`, so a pair the
engine refused would be a row Growth loses at cutover.

| App | Seam keys (seams × 5) | Common-surface keys | Locked-feature keys | Keys |
|---|---|---|---|---|
| `harvest-home` | 15 (3) | 6 | 0 | 21 |
| `home-ready` | 15 (3) | 6 | 0 | 21 |
| `home-stretch` | 15 (3) | 6 | 0 | 21 |
| `newsletter-studio` | 15 (3) | 6 | 0 | 21 |
| `open-house-hub` | 15 (3) | 6 | 0 | 21 |
| `market-intel` | 15 (3) | 6 | 0 | 21 |
| `pathfinder-pro` | 20 (4) | 6 | 84 | 110 |
| `the-drumbeat` | 15 (3) | 6 | 0 | 21 |
| **Total** | **125** | **48** | **84** | **257** |

- **Seams are Rello's `UPSELL_SEAMS`** (`src/lib/upsell/seam-registry.ts` at Rello `9fd58f997`); **seam events are `UPSELL_EVENTS`**
  of `@rello-platform/ui`: `shown`, `engaged`, `dismissed`, `clicked`, `converted`.
- **Common surfaces, all eight apps:** `upsell.menu-item.shown|clicked`, `upsell.trial-banner.shown`,
  `upsell.upgrade-page.shown|clicked|converted` (the spokes' `PAIRS` on main; `upgrade-page.converted` is Rello's, written by trial-start).
  Cited by file and line in the `src/registry.ts` comment.
- **`pathfinder-pro` locked-feature surfaces:** the 14 `PFP_LOCKED_FEATURE_SLUGS` of `@rello-platform/upgrade-content` v0.14.1
  (the tag PFP pins) × `shown`, `clicked`, `preview-opened`, `preview-explored`, `blocked-hint`, `dismissed` (PFP `telemetry.ts` `LOCK_EVENTS`).
- **Not registered:** `<app>.audit.upsell-nudge.*` (not part of S11).
- Longest key 58 characters (cap 80). Rello, `home-scout`, `the-oven`, `arive` and `prequal-pro` register no upsell key.
- `tests/registry-spokes-v050.test.ts` reads `FEATURES` without the appended upsell keys, so it still pins the v0.5.0 entries;
  `tests/registry-upsell-v060.test.ts` pins the new ones.

## v0.5.0 — 2026-11-24 (U3: the ten spoke apps' registries, Platform KA prompt 1874; ruling U2-RULED-KA1858)

Registry only. `FEATURES[app]` and `ROUTES[app]` for the ten spokes, keyed by `APP_SLUGS` index handles with
`satisfies` (the Rello pattern, no literal slug list). Rello's entries are byte for byte unchanged. The event
schemas, the page script (`dist/script/s.js`, same bytes, 7214 B, 3337 B gzip), the server helper, the redirect and
the wire contract are unchanged.

| App | FEATURES | ROUTES |
|---|---|---|
| `pathfinder-pro` | 11 | 12 |
| `harvest-home` | 12 | 2 |
| `home-ready` | 12 | 17 |
| `home-scout` | 10 | 13 |
| `open-house-hub` | 10 | 2 |
| `newsletter-studio` | 12 | 3 |
| `market-intel` | 10 | 9 |
| `home-stretch` | 11 | 6 |
| `the-drumbeat` | 12 | 10 |
| `the-oven` | 12 | 22 |
| **Total** | **112** | **96** |

- **ROUTES hold server-rendered screens only** (ruling 1): a `"use client"` page has no server render to send from.
- **Drumbeat takes its 10-route trim**, not 37 (ruling 2). **home-ready has no `/guest-mlo/*`** (ruling 6: an invited
  outside loan officer is not the paying customer). A page served under `/apps/<slug>/*` reports the app's own template (ruling 3).
- **pathfinder-pro** keeps `intakes.create` and adds no save-lead keys; **harvest-home** registers both `byol.upload` and
  `byol.commit` (ruling 8).
- The same word (`leads.create`, `milo.chat`, `events.create`) may appear under several apps; a key is refused for an app that has not registered it.
- `arive` and `prequal-pro` register nothing.
- Tests: `tests/registry-spokes-v050.test.ts` (22 tests). `tests/registry-rello-s9.test.ts` "no other app registers a feature yet"
  is now "the two apps that are not Rello and not one of the ten spokes register no feature" (the old assertion is what this release retires).
- README install line now names `#v0.5.0`.

## v0.4.0 — 2026-11-23 (S12b package half, Platform KA prompts 1784 and 1808; #6)

The package half of S12b, including the page script's ads hook (ships at `/t/s.v1.2.js`).

- **The page-script size limit is 3,584 B gzip** (was 3,072 B): KA ruling 1786, plan §4 and S12 design §3.5,
  marker `S12-SIZE-KA1786`. With the hook, `dist/script/s.js` is 7214 B minified, 3337 B gzip.
- **The ads hook** (`marketing` and `tenant_site` only; never `spoke_public` or `in_app`, design §3.4): one `pageId`
  per document load and `nav` (`load` | `spa`) on `page.view`; `landing.adclick` on the first batch when the URL
  carries an ad-click key; `window.__rt.ads(reason)` → one `ads.decision` per `pageId`; `/t/a.v1.js` appended once
  per document after `load` and an idle callback, with no GPC skip.

- **Client events** (`CLIENT_EVENT_SCHEMAS`, `parseClientEvent`): `landing.adclick {pageId, params}` and
  `ads.decision {pageId, reason}`. They are what the page script sends; the edge transforms them. The 12 stored
  events are unchanged in number.
- **Stored schema fields** (all optional):
  - `page.view.pageId` / `page.view.nav` (`load` | `spa`), accepted on `marketing` and `tenant_site` only;
  - `visit.start.adClick` / `link.hit.adClick`, written by the edge: 1–4 `{kind, id}`, unique kinds.
- **`/t/c` strips the four ad-click keys** as well as `rg` and `r`; every other key is kept.
- **Constants:** `AD_CLICK_KEYS`, `AD_CLICK_VALUE`, `ADS_REASONS`, `ADS_VENDORS` (empty), `RTK_LETTERS`
  (`t`, `c`, `p`), `RTK_RESERVED_LETTERS` (`f`), `ADS_LOADER_PATH` (`/t/a.v1.js`).
- **The loader body:** `adsLoaderScript` / `adsNoTagScript` (≤ 2 KB gzip, its own test).
- **Build test:** `dist/script/s*.js` carries no vendor hostname.
- README install line now names `#v0.4.0`.

## v0.3.1 — 2026-11-23 (S10, Platform KA prompts 1775 and 1781; GD-3035; #5)

- **The page script sends only `page.view` on `spoke_public`** (plan §3.3 item 4). On that surface it no longer
  installs the scroll, `IntersectionObserver` (`[data-section]`), click (`[data-cta]` / `[data-widget]`) or
  `pagehide` listeners, so `scroll.depth`, `section.read`, `cta.click`, `widget.use` and `page.leave` cannot be
  sent from a client portal. `page.view` on load and on an in-page route change is unchanged.
- `marketing`, `tenant_site` and `in_app` are unchanged: the same listeners, and the same batches for the same
  actions (differential replay of the v0.3.0 bundle against this one).
- `dist/script/s.js` changes: sha256 `379d161e125917478bbfa118767e5df5b25370aa1d7bc18d4ac62db0da07b01d`, 6546 B,
  3001 B gzip (limit 3072). The engine must re-pin and re-embed it after the tag.

## v0.3.0 — 2026-11-23 (S9 part 3, Platform KA prompt 1747; #3)

Rello's registry entries:

- `FEATURES.rello` registers eleven keys, one per signed-in server action Growth reads: `leads.create`,
  `leads.import`, `leads.export`, `leads.stage-change`, `leads.note-create`, `tasks.create`,
  `campaigns.create`, `campaigns.launch`, `journeys.enroll`, `nurture.reengage-enroll`, `milo.chat`. Every
  other app still registers none, so its `feature.used` is still refused.
- `ROUTES.rello` adds nine in-app screen templates, sent as `screen.opened` by Rello's server pages:
  `/leads`, `/campaigns`, `/campaigns/[id]`, `/conversations`, `/calendar`, `/team`, `/apps`, `/broker`,
  `/realtor-prospects/[id]`. The seven earlier templates are unchanged and keep their order.
- Registry only: `dist/script/s.js` is unchanged (it reads templates from the tag's `data-routes`).
- The `src/server.ts` header now describes the GD-3047 200 rule (comment only).

## v0.2.0 — 2026-11-23 (S9 part 1, Platform KA prompt 1740)

- **`@rello-platform/tracking/server`: `createTracker()` and `track()`**, the in-app server sender to plan
  §5.5 L5 and the "Sign-in and app requests" seam:
  - `track()` returns synchronously and never throws into the caller;
  - each event is validated with `EVENT_SCHEMAS` and the `FEATURES` / `ROUTES` registries; an unregistered
    feature or route, or any other invalid event, is dropped and counted, never sent;
  - in-process buffer, sent every ≤ 10 s or at 100 events, whichever comes first;
  - each attempt has a 2 s timeout; only an unavailable answer (no answer, timeout, 429, 5xx) is retried, 3 times
    over about 30 s; a refusal (other 4xx) is never retried;
  - after the last retry, one counted line: `tracking_events_dropped app=<slug> count=<n> reason=unavailable …`;
  - log lines carry the app, event names, counts, reasons and statuses only, never a field value;
  - the host hook `track(input, { defer })` / `createTracker({ defer })` hands a send to Next.js `after()` or a
    Worker's `ctx.waitUntil`.
  - Runs on Node ≥ 19 and on Cloudflare Workers: no Node-only or browser-only API.
- **The wire contract** the engine's server intake builds to (SPEC-S9-ENGINE-SERVER-INTAKE-261123):
  `SERVER_INTAKE_PATH` (`/v1/events`), `SERVER_BATCH_SCHEMA` (`{ v: 1, app, batchId, events }`, ≤ 100 events),
  `SERVER_BATCH_MAX_BYTES`, `classifyStatus`.
- **Schema change: `feature.used` and `screen.opened` no longer require the seven edge facts.** `visitorId`,
  `sessionId`, `country`, `region`, `deviceClass`, `ipHash` and `gpc` are optional on these two events only
  (`SERVER_EVENT_NAMES`). An app server has none of the edge's facts about a browser, and v0.1.x required all
  seven, so no server event could be valid without inventing them. The browser intake refuses both events by
  name, and every browser event still requires all seven. The engine's columns for them are already nullable.
- `dist/script/s.js` is unchanged (byte-identical).
- **Fix round (AUDIT 138, Platform KA prompt 1743), still PROPOSED, not tagged:**
  - GD-3041: a 200 whose body can't be read (the 2 s deadline firing mid-body, a network drop, invalid JSON) or
    isn't the partial shape (`refused` an array no longer than the batch) is now UNAVAILABLE and retried with the
    same batchId and event ids, then one counted drop. Before, it counted the whole batch accepted.
    `partialRefusedCount()` is exported for the engine's contract test.
  - GD-3042: a per-call `defer` passed to a `track()` that only buffers is handed the 10 s timed send, so a
    Worker's `waitUntil` keeps it alive with no later request. `options.defer` still takes the timer's send.
  - A runtime whose `setTimeout` throws no longer strands the event: `track()` sends at once instead, and an
    attempt that cannot arm its 2 s timer counts as unavailable.
- **Fix round (AUDIT 138 GD-3047, Platform KA prompt 1752), still PROPOSED, not tagged:** a 200 counts only
  when its body is exactly the spec's partial answer (§4 step 8): `stored` a non-negative integer; `refused` a
  non-empty array of `{ i, reason }`, each `i` a distinct integer with `0 ≤ i < events`, each `reason` a
  non-empty string; no other key at the top or on an entry; `stored + refused.length === events`. Before, any
  object whose `refused` was an array no longer than the batch counted, so `{ stored: 0, refused: [] }` for a
  3-event batch counted all 3 accepted. Any other 200 body is unavailable: retried with the same batchId and
  event ids, then one counted drop. 4xx refusals are unchanged (never retried).

Earlier releases (v0.1.0, v0.1.1, v0.1.2) are described in their commit messages and the README.

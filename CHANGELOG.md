# Changelog

## Unreleased (S12b package half, Platform KA prompt 1784) — DRAFT

The page script's ads hook is NOT in this change: it does not fit the 3,072 B gzip guard (see the PR). This is
everything else in the package half, so the engine half can build against it.

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
- `dist/script/s.js` is byte-identical to v0.3.1 (sha256 `379d161e…`).
- README install line now names `#v0.3.1`.

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

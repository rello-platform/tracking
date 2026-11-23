# Changelog

## v0.2.0 — PROPOSED, not tagged (S9 part 1, Platform KA prompt 1740)

Draft for audit. Not tagged and not published: `package.json` stays at 0.1.2 until the release is cut.

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

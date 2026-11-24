/**
 * The two reviewed registries every in-app event is checked against.
 *
 * - `FEATURES[app]`: the `feature.used.feature` values an app may send (plan §3.1, §3.3).
 * - `ROUTES[app]`: the route TEMPLATES an app may send as `screen.opened.route`, and as
 *   `path` on `spoke_public` / `in_app` surfaces (plan §3.2, Rev 2 GD-2689).
 *
 * Membership is the protection: a value that is not registered here, in a reviewed
 * package release, is refused at intake. The grammar below only stops a concrete value
 * (a number, an id) from being registered by mistake; it is not the access rule.
 *
 * App keys come from `@rello-platform/slugs`. Each registry is an exhaustive mapped
 * type over `AppSlug`, so a key that is not a canonical slug is a compile error, and a
 * new app in the slugs package must be added here before this package compiles.
 */
import { APP_SLUGS, type AppSlug } from "@rello-platform/slugs";

// Named handles for the apps that register something. Each is read from the canonical
// list by index and checked against its slug by `satisfies`, so a reorder of APP_SLUGS
// fails tsc here instead of silently registering under the wrong app.
const RELLO = APP_SLUGS[1] satisfies "rello";
// v0.5.0 (U3, Platform KA 1874): the ten spoke apps.
const HARVEST_HOME = APP_SLUGS[2] satisfies "harvest-home";
const HOME_READY = APP_SLUGS[3] satisfies "home-ready";
const HOME_STRETCH = APP_SLUGS[4] satisfies "home-stretch";
const HOME_SCOUT = APP_SLUGS[5] satisfies "home-scout";
const MARKET_INTEL = APP_SLUGS[6] satisfies "market-intel";
const NEWSLETTER_STUDIO = APP_SLUGS[7] satisfies "newsletter-studio";
const THE_OVEN = APP_SLUGS[8] satisfies "the-oven";
const THE_DRUMBEAT = APP_SLUGS[9] satisfies "the-drumbeat";
const OPEN_HOUSE_HUB = APP_SLUGS[10] satisfies "open-house-hub";
const PATHFINDER_PRO = APP_SLUGS[11] satisfies "pathfinder-pro";

/** A route template: "/" or segments that are lowercase static words (no digits) or `[camelCaseParam]`. */
export const ROUTE_TEMPLATE_GRAMMAR = /^(\/|(\/([a-z]+(-[a-z]+)*|\[[a-z][a-zA-Z]*\]))+)$/;

/** A feature key: lowercase dotted/hyphenated words, no digits-only part. */
export const FEATURE_KEY_GRAMMAR = /^[a-z][a-z0-9]*(-[a-z0-9]+)*(\.[a-z][a-z0-9]*(-[a-z0-9]+)*)*$/;
export const FEATURE_KEY_MAX = 80;

type Registry = { readonly [A in AppSlug]: readonly string[] };

function registry(entries: Partial<Record<AppSlug, readonly string[]>>): Registry {
  const out = {} as Record<AppSlug, readonly string[]>;
  for (const app of APP_SLUGS) out[app] = Object.freeze([...(entries[app] ?? [])]);
  return Object.freeze(out);
}

/**
 * Registered route templates. v0.1.0 registers Rello's lead screen (the plan's own
 * example) and Rello's two client-portal pages (§3.3 item 4). Each later app adds its
 * own in its S9 / S10 package release.
 *
 * S10 (Rello's public pages, Platform KA 1664) adds the three pages whose URL carries a
 * token or a person's slug, so their tag can send the template instead (§3.2), and the
 * portal's own dashboard page for the later portal unit.
 *
 * v0.5.0 (U3, Platform KA 1874, ruling U2-RULED-KA1858) registers the ten spokes' own in-app
 * screens, and only the screens that can send: a server-rendered page. A client-only
 * screen is not registered (HH 2, OHH 2, NS 3, THS 6 are registrable; wrapper pages are a
 * later unit). Drumbeat takes its 10-route trim; home-ready has no /guest-mlo/* (an invited
 * outside loan officer is not the paying customer); a page served inside Rello under
 * /apps/<slug>/* reports the app's own template, with no embed prefix. A client-portal,
 * borrower or homeowner screen is never registered (plan §3.3 item 4).
 *
 * ORDER MATTERS: both matchers (`matchRoute` here, `matchTemplate` in the page script)
 * return the FIRST template that matches. A static template therefore comes before any
 * `[param]` template of the same shape — "/c/dashboard" before "/c/[token]" — or it can
 * never match. tests/registry-rello-s10.test.ts checks every static template matches itself.
 */
export const ROUTES: Registry = registry({
  [RELLO]: [
    "/leads/[id]",
    "/c/dashboard",
    "/c/[token]",
    "/d/[token]",
    "/rate-check/[slug]",
    "/growth/interest/[token]",
    "/signup-link/[token]",
    // S9 part 3 (Platform KA 1747): Rello's in-app screens, sent as `screen.opened` by the
    // server page itself, which already holds the signed-in session (no extra session read).
    // Only server-rendered pages are here; a "use client" page has no server render to send from.
    "/leads",
    "/campaigns",
    "/campaigns/[id]",
    "/conversations",
    "/calendar",
    "/team",
    "/apps",
    "/broker",
    "/realtor-prospects/[id]",
  ],
  [PATHFINDER_PRO]: [
    "/dashboard/scenarios",
    "/dashboard/pipeline",
    "/dashboard/rates",
    "/dashboard/events",
    "/dashboard/events/[eventId]",
    "/dashboard/exports",
    "/dashboard/exports/[id]",
    "/dashboard/loan-programs",
    "/dashboard/loan-programs/[slug]",
    "/dashboard/dscr-advisor",
    "/dashboard/hecm-advisor",
    "/dashboard/bankstatement-advisor",
  ],
  [HARVEST_HOME]: ["/onboarding/welcome", "/upgrade"],
  [HOME_READY]: [
    "/dashboard",
    "/dashboard/leads",
    "/dashboard/leads/add",
    "/dashboard/leads/[id]",
    "/dashboard/journeys",
    "/dashboard/journeys/builder",
    "/dashboard/journeys/builder/[templateId]",
    "/dashboard/mlo",
    "/dashboard/mlo/agents",
    "/dashboard/mlo/agents/[id]",
    "/dashboard/mlo/analytics",
    "/dashboard/mlo/leaderboard",
    "/dashboard/mlo/source-analytics",
    "/dashboard/notifications",
    "/dashboard/qr-code",
    "/dashboard/invite",
    "/dashboard/settings",
  ],
  [HOME_SCOUT]: [
    "/dashboard",
    "/analytics",
    "/branding",
    "/ctas",
    "/embeds",
    "/forms",
    "/identity",
    "/landing-pages",
    "/landing-pages/new",
    "/landing-pages/[id]/edit",
    "/privacy-requests",
    "/tenant-settings",
    "/tools",
  ],
  [OPEN_HOUSE_HUB]: ["/dashboard/co-hosting", "/dashboard/upgrade"],
  [NEWSLETTER_STUDIO]: ["/dashboard/settings/sources", "/dashboard/settings/writing-style", "/dashboard/upgrade"],
  [MARKET_INTEL]: [
    "/admin",
    "/admin/digests",
    "/admin/queue",
    "/admin/subscribers",
    "/admin/sources",
    "/admin/websites",
    "/admin/podcast",
    "/admin/announcements",
    "/admin/branding",
  ],
  [HOME_STRETCH]: [
    "/dashboard/agent",
    "/dashboard/invite",
    "/dashboard/settings",
    "/dashboard/settings/apps",
    "/dashboard/settings/articles",
    "/dashboard/settings/team",
  ],
  [THE_DRUMBEAT]: [
    "/dashboard",
    "/campaigns",
    "/campaigns/[id]",
    "/content/social",
    "/content/blog",
    "/content/video",
    "/listings",
    "/outreach/audiences",
    "/outreach/direct-mail",
    "/pages/qr-codes",
  ],
  [THE_OVEN]: [
    "/dashboard",
    "/alerts",
    "/check-ins",
    "/homeowner-hub",
    "/past-clients",
    "/past-clients/[relloLeadId]",
    "/referrals",
    "/referrals/new",
    "/referrals/[id]",
    "/reviews",
    "/reviews/analytics",
    "/reviews/connect/yelp",
    "/reviews/inbox",
    "/reviews/request",
    "/reviews/testimonials",
    "/reviving",
    "/reviving/campaign",
    "/reviving/[id]",
    "/service-providers",
    "/settings",
    "/transition",
    "/transition/[leadId]",
  ],
});

/**
 * The RELLO UPSELL events (`UPSELL_EVENTS` in @rello-platform/ui), the last word of a hub signal name
 * `<app>.upsell.<seam>.<event>`. `converted` is written by Rello's trial-start for a started trial.
 */
const UPSELL_EVENT_NAMES = ["shown", "engaged", "dismissed", "clicked", "converted"] as const;

/**
 * The eight standalone apps' upsell seams: Rello's `UPSELL_SEAMS` (src/lib/upsell/seam-registry.ts @ Rello main
 * 9fd58f997), one list per app, keyed by the app's slug handle above. The apps are the eight
 * `UPSELL_SOURCE_APPS` of @rello-platform/signals v0.41.0; Rello, home-scout and the-oven sell nothing, so they
 * have no entry. A seam is registered here only if Rello's registry holds it.
 */
const UPSELL_SEAMS: { readonly [A in AppSlug]?: readonly string[] } = Object.freeze({
  [HARVEST_HOME]: ["property-watch-trigger", "dashboard-hot-leads", "score-cold-lead-rescue"],
  [HOME_READY]: ["lead-ready-threshold", "journey-cadence-config", "pillar-blocker-insight"],
  [HOME_STRETCH]: ["pre-approval-readiness-achieved", "journey-complete-graduation", "stall-detected-re-engagement"],
  [NEWSLETTER_STUDIO]: ["newsletter-multi-channel-orchestration", "analytics-cross-app-intelligence", "audience-expansion-via-multi-source-leads"],
  [OPEN_HOUSE_HUB]: ["hot-lead-alert-silence", "conversion-funnel-wall", "neighbor-referral-orphan"],
  [MARKET_INTEL]: ["content-repurposing", "send-performance-analytics", "subscriber-segmentation-advanced"],
  [PATHFINDER_PRO]: ["multi-channel-borrower-touch", "post-export-revenue-attribution", "pre-intake-nurture-history", "agent-events-locked"],
  [THE_DRUMBEAT]: ["auto-task-hot-lead", "full-timeline", "pages-create-custom"],
});

/**
 * The three surfaces every one of the eight source apps emits besides its seams, and the events each carries
 * (`PAIRS` in each spoke's src/lib/upsell/telemetry.ts on main: HH f3db5cabe :31-33, HR 1f58e9da3 :74-76,
 * HS 1b9ee6afa :75-77, NS afb8bd3fb :37-39, OHH dbad16a3a :75-77, MarketIntel-NEW e258e9c54 :74-76,
 * PFP 511d19114 :69-71, TD 960ea5e62 :22-24). `converted` on `upgrade-page` is Rello's: trial-start writes
 * `<source>.upsell.upgrade-page.converted` for any source app (seam-registry.ts UPGRADE_PAGE_SEAM). Growth's
 * interest read counts any surface's `.clicked` and `upgrade-page.shown` (upgrades-summary.ts:447-450 @ 9fd58f997).
 */
const UPSELL_COMMON_SURFACES: readonly (readonly [string, readonly string[]])[] = Object.freeze([
  ["menu-item", ["shown", "clicked"]],
  ["trial-banner", ["shown"]],
  ["upgrade-page", ["shown", "clicked", "converted"]],
]);

/**
 * Pathfinder Pro's locked-feature surfaces: `PFP_LOCKED_FEATURE_SLUGS` of @rello-platform/upgrade-content v0.14.1
 * (src/pfp.ts:32-47, the tag PFP pins), each emitted with `LOCK_EVENTS` (PFP src/lib/upsell/telemetry.ts:45, wired
 * for every slug at :74, @ 511d19114).
 */
const PFP_LOCKED_FEATURE_SURFACES = [
  "call-workstation",
  "quick-quote",
  "hecm-advisor",
  "va-advisor",
  "dscr-advisor",
  "bank-statement-advisor",
  "pre-approval-letter",
  "events",
  "loan-programs",
  "exports",
  "check-your-rate",
  "refi-radar",
  "rate-widget",
  "email-signature",
] as const;
const PFP_LOCK_EVENT_NAMES = ["shown", "clicked", "preview-opened", "preview-explored", "blocked-hint", "dismissed"] as const;

/**
 * v0.6.0 (U21, Platform KA 1884, widened by 1885): an app's `upsell.<surface>.<event>` keys. In order: Rello's seams of
 * the app × five events; the three common surfaces; for pathfinder-pro, its 14 locked-feature surfaces × six events.
 * S11 sends a spoke's upsell telemetry as `feature.used` with `feature = "upsell.<surface>.<event>"`; the hub name
 * is `<app>.` in front of the key, so the mapping is exact in both directions.
 */
function upsell(app: AppSlug): readonly string[] {
  const seams = UPSELL_SEAMS[app];
  if (seams === undefined) return [];
  const keys = seams.flatMap((seam) => UPSELL_EVENT_NAMES.map((event) => `upsell.${seam}.${event}`));
  for (const [surface, events] of UPSELL_COMMON_SURFACES) for (const event of events) keys.push(`upsell.${surface}.${event}`);
  if (app === PATHFINDER_PRO) {
    for (const slug of PFP_LOCKED_FEATURE_SURFACES) for (const event of PFP_LOCK_EVENT_NAMES) keys.push(`upsell.${slug}.${event}`);
  }
  return keys;
}

/**
 * Registered features. v0.1.x registered none. S9 adds each app's features, and S11
 * adds `upsell.<seam>.<event>` keys, each in a reviewed release. An app with nothing
 * registered has every `feature.used` refused, which is the intended state for a
 * vocabulary nobody has reviewed yet.
 *
 * S9 part 3 (Platform KA 1747) registers Rello's first eleven: one per signed-in server
 * action Growth reads, each sent once after that action's own write succeeds. A key names
 * the action only: no lead, client, campaign or user value can be a feature.
 *
 * v0.5.0 (U3, Platform KA 1874) registers the ten spokes' own keys, one per signed-in
 * action the app's server runs after its own write succeeds. The same word may appear under
 * several apps (`leads.create`, `milo.chat`): the registry is keyed by app, and a key is
 * refused for an app that has not registered it. Rulings (U2-RULED-KA1858): pathfinder-pro
 * keeps `intakes.create` (the app's own word, no save-lead keys); harvest-home registers both
 * `byol.upload` and `byol.commit`; home-scout's `settings.update` stays.
 *
 * v0.6.0 (U21, Platform KA 1884, widened by 1885; plan marker S11B-KA1881) appends, for the eight apps that sell
 * Rello an upgrade, every `upsell.<surface>.<event>` key an app emits or Rello writes under its family: the app's
 * seams × shown, engaged, dismissed, clicked, converted; menu-item, trial-banner and upgrade-page; and Pathfinder
 * Pro's locked-feature surfaces (see `upsell()` above). The v0.5.0 entries are unchanged and stay in front. Not
 * registered: `<app>.audit.upsell-nudge.*` (not part of S11).
 */
export const FEATURES: Registry = registry({
  [RELLO]: [
    "leads.create",
    "leads.import",
    "leads.export",
    "leads.stage-change",
    "leads.note-create",
    "tasks.create",
    "campaigns.create",
    "campaigns.launch",
    "journeys.enroll",
    "nurture.reengage-enroll",
    "milo.chat",
  ],
  [PATHFINDER_PRO]: [
    "intakes.create",
    "scenarios.create",
    "scenarios.deliver",
    "pipeline.stage-change",
    "pipeline.note-create",
    "pre-approval.send",
    "rate-sheets.upload",
    "events.create",
    "intakes.export",
    "lenders.create",
    "refi-radar.upload",
    ...upsell(PATHFINDER_PRO),
  ],
  [HARVEST_HOME]: [
    "byol.upload",
    "byol.commit",
    "byol.action-run",
    "leads.manual-create",
    "call-list.mark-contacted",
    "call-list.snooze",
    "call-list.send-to-nurture",
    "pipeline.session-start",
    "discovery.unlock",
    "discovery.saved-search-create",
    "property-watch.create",
    "crm.connect",
    ...upsell(HARVEST_HOME),
  ],
  [HOME_READY]: [
    "leads.create",
    "leads.invite-send",
    "prospects.invite",
    "leads.note-create",
    "leads.document-upload",
    "leads.share",
    "leads.export-arive",
    "leads.mlo-assign",
    "journeys.enroll",
    "journeys.create",
    "agents.invite",
    "messages.send",
    ...upsell(HOME_READY),
  ],
  [HOME_SCOUT]: [
    "widgets.create",
    "landing-pages.create",
    "landing-pages.publish",
    "ctas.create",
    "forms.create",
    "testimonials.create",
    "identity.update",
    "settings.update",
    "guest-mlo.link",
    "privacy-requests.answer",
  ],
  [OPEN_HOUSE_HUB]: [
    "events.create",
    "attendees.add",
    "events.cohost-invite",
    "showings.create",
    "showings.confirm",
    "showings.complete",
    "tours.create",
    "tours.itinerary-send",
    "seller-listings.create",
    "follow-ups.send",
    ...upsell(OPEN_HOUSE_HUB),
  ],
  [NEWSLETTER_STUDIO]: [
    "newsletters.create",
    "newsletters.send",
    "newsletters.schedule",
    "newsletters.test-send",
    "templates.create",
    "flows.create",
    "flows.enroll-lead",
    "leads.create",
    "leads.import",
    "listings.create",
    "sources.feed-add",
    "writing-styles.create",
    ...upsell(NEWSLETTER_STUDIO),
  ],
  [MARKET_INTEL]: [
    "digests.generate",
    "digests.send",
    "breaking-news.send",
    "subscribers.invite",
    "subscribers.access-approve",
    "sources.create",
    "websites.create",
    "announcements.create",
    "podcast.settings-update",
    "branding.update",
    ...upsell(MARKET_INTEL),
  ],
  [HOME_STRETCH]: [
    "leads.create",
    "leads.update",
    "leads.activity-create",
    "leads.score-recalculate",
    "leads.document-upload",
    "leads.tag-update",
    "invitations.create",
    "agents.invite-resend",
    "mlo-partners.create",
    "milo.chat",
    "milo.lead-analysis",
    ...upsell(HOME_STRETCH),
  ],
  [THE_DRUMBEAT]: [
    "campaigns.create",
    "social.post-create",
    "social.post-publish",
    "content.draft-approve",
    "blog.post-publish",
    "video.upload",
    "direct-mail.send",
    "listings.campaign-dispatch",
    "audiences.create",
    "qr-codes.create",
    "bio-links.create",
    "utm-links.create",
    ...upsell(THE_DRUMBEAT),
  ],
  [THE_OVEN]: [
    "referrals.create",
    "programs.create",
    "reviews.request",
    "reviews.response-post",
    "reviews.testimonial-approve",
    "reviews.connect",
    "hub.invite-send",
    "revival.start",
    "transition.hand-off",
    "service-providers.create",
    "check-ins.configure",
    "past-clients.create",
  ],
});

/** Match a pathname against templates; each `[param]` matches exactly one segment. */
export function matchRoute(pathname: string, templates: readonly string[]): string | undefined {
  const parts = splitPath(pathname);
  if (parts === undefined) return undefined;
  for (const t of templates) {
    const tp = splitPath(t);
    if (tp === undefined || tp.length !== parts.length) continue;
    if (tp.every((seg, i) => (seg.startsWith("[") ? parts[i] !== "" : seg === parts[i]))) return t;
  }
  return undefined;
}

function splitPath(p: string): string[] | undefined {
  if (typeof p !== "string" || !p.startsWith("/") || p.length > 512) return undefined;
  return p === "/" ? [] : p.slice(1).split("/");
}

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
import { type AppSlug } from "@rello-platform/slugs";
/** A route template: "/" or segments that are lowercase static words (no digits) or `[camelCaseParam]`. */
export declare const ROUTE_TEMPLATE_GRAMMAR: RegExp;
/** A feature key: lowercase dotted/hyphenated words, no digits-only part. */
export declare const FEATURE_KEY_GRAMMAR: RegExp;
export declare const FEATURE_KEY_MAX = 80;
type Registry = {
    readonly [A in AppSlug]: readonly string[];
};
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
 * v0.8.0 (S10 prep for U16–U18, Platform KA 2022) appends PAGE templates, each after the app's in-app list: Home
 * Scout's agent pages and homeowner hub, HomeReady's agent page and its two lead pages, The Home Stretch's client
 * portal. These are spoke_public templates sent by the S10 page tag (`data-routes`); a path never carries the id. The
 * "no client-portal screen" rule above is about in-app (S9) screens; the portal templates here are KA 2022's S10 order.
 *
 * ORDER MATTERS: both matchers (`matchRoute` here, `matchTemplate` in the page script)
 * return the FIRST template that matches. A static template therefore comes before any
 * `[param]` template of the same shape — "/c/dashboard" before "/c/[token]" — or it can
 * never match. tests/registry-rello-s10.test.ts checks every static template matches itself.
 */
export declare const ROUTES: Registry;
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
export declare const FEATURES: Registry;
/** Match a pathname against templates; each `[param]` matches exactly one segment. */
export declare function matchRoute(pathname: string, templates: readonly string[]): string | undefined;
export {};
//# sourceMappingURL=registry.d.ts.map
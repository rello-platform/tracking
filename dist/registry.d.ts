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
 */
export declare const ROUTES: Registry;
/**
 * Registered features. v0.1.0 registers none: S9 adds each app's features, and S11
 * adds `upsell.<seam>.<event>` keys, each in a reviewed release. Until then every
 * `feature.used` is refused, which is the intended state for a vocabulary nobody has
 * reviewed yet.
 */
export declare const FEATURES: Registry;
/** Match a pathname against templates; each `[param]` matches exactly one segment. */
export declare function matchRoute(pathname: string, templates: readonly string[]): string | undefined;
export {};
//# sourceMappingURL=registry.d.ts.map
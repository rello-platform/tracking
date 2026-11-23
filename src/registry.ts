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

// Named handles for the apps that register something in v0.1.0. Each is read from the
// canonical list by index and checked against its slug by `satisfies`, so a reorder of
// APP_SLUGS fails tsc here instead of silently registering under the wrong app.
const RELLO = APP_SLUGS[1] satisfies "rello";

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
});

/**
 * Registered features. v0.1.x registered none. S9 adds each app's features, and S11
 * adds `upsell.<seam>.<event>` keys, each in a reviewed release. An app with nothing
 * registered has every `feature.used` refused, which is the intended state for a
 * vocabulary nobody has reviewed yet.
 *
 * S9 part 3 (Platform KA 1747) registers Rello's first eleven: one per signed-in server
 * action Growth reads, each sent once after that action's own write succeeds. A key names
 * the action only: no lead, client, campaign or user value can be a feature.
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

/**
 * The 12 events (plan §3.1). Every schema is `.strict()`: no event has a free-form
 * property bag, and an extra key is refused (§3.3 item 1). Every string is bounded
 * (§3.3 item 5; enforced by `findUnboundedStrings` in ./guards and its test).
 *
 * These are the STORED events: the common fields are filled in by the edge or the app
 * server and are never trusted from a browser (§3.1). The page script sends only the
 * event name and its own fields; the edge adds the rest and validates the result here.
 *
 * The event name is carried in `name`.
 */
import { z } from "zod";
import { APP_SLUGS, type AppSlug } from "@rello-platform/slugs";
import { FEATURES, ROUTES, FEATURE_KEY_MAX } from "./registry.js";
import { AD_CLICK_KEYS, AD_CLICK_VALUE } from "./ads.js";

export const EVENT_NAMES = [
  "link.hit",
  "link.scanned",
  "visit.start",
  "page.view",
  "page.leave",
  "scroll.depth",
  "section.read",
  "cta.click",
  "widget.use",
  "identify",
  "screen.opened",
  "feature.used",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const SURFACES = ["marketing", "tenant_site", "spoke_public", "in_app"] as const;
export const DEVICE_CLASSES = ["mobile", "tablet", "desktop", "bot"] as const;
export const UA_CLASSES = ["browser", "scanner", "prefetch", "bot", "unknown"] as const;
export const ASN_CLASSES = ["residential", "mobile", "business", "hosting", "security_vendor", "unknown"] as const;
/** The site page-type enum for `page.view.pageType` (read from `<meta name="rello:page-type">`, §10). */
export const PAGE_TYPES = [
  "home", "feature", "pricing", "compare", "integrations", "about", "blog", "article",
  "contact", "legal", "signup", "listing", "portal", "app", "other",
] as const;
export const SCROLL_DEPTHS = [25, 50, 75, 100] as const;
export const WIDGET_ACTIONS = ["open", "change", "submit"] as const;
export const IDENTIFY_SOURCES = ["email_token", "sign_in", "form", "checkout"] as const;

const ID = z.string().max(64).regex(/^[A-Za-z0-9_-]{1,64}$/);
const SLUG_ID = z.string().max(64).regex(/^[a-z0-9-]{1,64}$/);
const HOST = z.string().max(253).regex(/^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/);
/** A pathname: starts with "/", no query, no fragment, no whitespace. */
const PATH = z.string().max(512).regex(/^\/[^\s?#]*$/);
/** The recipient token shape `r<v>.<recipientId>.<mac>` (§2.3); only Rello verifies it. */
const TOKEN = z.string().max(160).regex(/^r[0-9]{1,3}\.[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9_-]{1,64}$/);
const UTM_VALUE = z.string().max(100);
/**
 * S12 design §5.1 Rev 3: the ad-click ids the EDGE writes on `visit.start` and `link.hit` (from the
 * client's `landing.adclick`, or from `/t/c`'s own URL). Up to 4, one per kind. Never browser-written.
 */
const AD_CLICK = z
  .array(z.object({ kind: z.enum(AD_CLICK_KEYS), id: z.string().max(512).regex(AD_CLICK_VALUE) }).strict())
  .min(1)
  .max(AD_CLICK_KEYS.length)
  .refine((xs) => new Set(xs.map((x) => x.kind)).size === xs.length, { message: "adClick kinds must be unique" })
  .optional();
/** S12 design §8 Rev 3 reach block: whether a page view is the document load or an in-page route change. */
export const PAGE_NAVS = ["load", "spa"] as const;

const COMMON = {
  id: z.uuid(),
  ts: z.iso.datetime(),
  tenantId: ID,
  app: z.enum(APP_SLUGS),
  surface: z.enum(SURFACES),
  visitorId: ID,
  sessionId: ID,
  clickId: ID.optional(),
  country: z.string().max(2).regex(/^[A-Z0-9]{2}$/),
  region: z.string().max(64),
  deviceClass: z.enum(DEVICE_CLASSES),
  ipHash: z.string().max(32).regex(/^[0-9a-f]{32}$/),
  gpc: z.boolean(),
} as const;

const named = <N extends EventName>(name: N) => ({ name: z.literal(name), ...COMMON });

/**
 * v0.2.0 (S9): the events only an app SERVER sends. The browser intake refuses both by name
 * (tracking-engine src/intake.ts BROWSER_EVENTS), so they reach the store only through the
 * keyed server intake.
 */
export const SERVER_EVENT_NAMES = ["feature.used", "screen.opened"] as const;
export type ServerEventName = (typeof SERVER_EVENT_NAMES)[number];

/**
 * v0.2.0 (S9): the common fields of a SERVER event. A server request carries none of the edge's
 * facts about a browser (country, region, device, hashed IP, GPC), and the visitor and session
 * exist only when the app passes the browser's ids along. So those seven are optional here and
 * left out when unknown: never filled with a guess, and never a reason to hold the event (no
 * new gate, HOW-KAs §23). The engine's columns for them are nullable (tracking-engine
 * migrations/0001_query_store.sql). id, ts, tenantId, app and surface stay required.
 */
const SERVER_COMMON = {
  ...COMMON,
  visitorId: COMMON.visitorId.optional(),
  sessionId: COMMON.sessionId.optional(),
  country: COMMON.country.optional(),
  region: COMMON.region.optional(),
  deviceClass: COMMON.deviceClass.optional(),
  ipHash: COMMON.ipHash.optional(),
  gpc: COMMON.gpc.optional(),
} as const;

const namedServer = <N extends ServerEventName>(name: N) => ({ name: z.literal(name), ...SERVER_COMMON });

// ── path rules (§3.2) ───────────────────────────────────────────────────────
// marketing: id-shaped segments must already be masked to `:id` by the edge.
const ID_SHAPED_SEGMENT = /^(?:\d{4,}|c[a-z0-9]{20,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|.*@.*)$/i;
// spoke_public / in_app: the path is a registered template of the event's app, never the URL.
const TEMPLATED_SURFACES = new Set<string>(["spoke_public", "in_app"]);

type PathCtx = { app: AppSlug; surface: (typeof SURFACES)[number]; path?: string };

function checkPath(e: PathCtx, ctx: z.RefinementCtx, routes: Registry, required: boolean): void {
  if (e.path === undefined) {
    // §3.2: a templated surface with no matching template sends no path; nothing else may omit it.
    if (required || !TEMPLATED_SURFACES.has(e.surface)) {
      ctx.addIssue({ code: "custom", path: ["path"], message: "path is required on this surface" });
    }
    return;
  }
  if (TEMPLATED_SURFACES.has(e.surface)) {
    if (!routeIsRegistered(routes, e.app, e.path)) {
      ctx.addIssue({ code: "custom", path: ["path"], message: `path is not a registered ${e.app} route template` });
    }
    return;
  }
  if (e.surface === "marketing" && e.path.split("/").some((seg) => ID_SHAPED_SEGMENT.test(seg))) {
    ctx.addIssue({ code: "custom", path: ["path"], message: "marketing path carries an unmasked id-shaped segment" });
  }
}

type Registry = { readonly [A in AppSlug]: readonly string[] };

/** Per-app enum built from a registry; an app with nothing registered refuses every value. */
function enumFor(reg: Registry, app: AppSlug): z.ZodType<string> {
  const values = reg[app];
  return values.length > 0 ? z.enum(values as [string, ...string[]]) : z.never();
}

function routeIsRegistered(routes: Registry, app: AppSlug, value: string): boolean {
  return enumFor(routes, app).safeParse(value).success;
}

/**
 * Build the 12 schemas against a pair of registries. The package exports them built
 * against `FEATURES` and `ROUTES` (`EVENT_SCHEMAS`); tests can build them against a
 * fixture registry to exercise an accepted `feature.used`.
 */
export function buildEventSchemas(reg: { features: Registry; routes: Registry }) {
  const pathEvent = <N extends EventName, S extends z.ZodRawShape>(name: N, shape: S, pathRequired = true) =>
    z
      .object({ ...named(name), path: PATH.optional(), ...shape })
      .strict()
      .superRefine((e, ctx) => checkPath(e as PathCtx, ctx, reg.routes, pathRequired && !TEMPLATED_SURFACES.has((e as PathCtx).surface)));

  const linkShape = { rg: ID.optional(), r: TOKEN.optional(), uaClass: z.enum(UA_CLASSES), asnClass: z.enum(ASN_CLASSES), adClick: AD_CLICK };

  return {
    "link.hit": z.object({ ...named("link.hit"), ...linkShape }).strict(),
    "link.scanned": z.object({ ...named("link.scanned"), ...linkShape }).strict(),
    "visit.start": z
      .object({
        ...named("visit.start"),
        landingPath: PATH,
        referrerHost: HOST.optional(),
        utm: z.object({ source: UTM_VALUE.optional(), medium: UTM_VALUE.optional(), campaign: UTM_VALUE.optional() }).strict().optional(),
        rg: ID.optional(),
        adClick: AD_CLICK,
      })
      .strict(),
    "page.view": z
      .object({
        ...named("page.view"),
        path: PATH.optional(),
        pageType: z.enum(PAGE_TYPES),
        title: z.string().max(120).optional(),
        // S12 design §8 Rev 3: one pageId per document load (the join key for ads.decision), and
        // whether this view is that load or an in-page route change.
        pageId: ID.optional(),
        nav: z.enum(PAGE_NAVS).optional(),
      })
      .strict()
      .superRefine((e, ctx) => {
        checkPath(e, ctx, reg.routes, !TEMPLATED_SURFACES.has(e.surface));
        const published = e.surface === "marketing" || e.surface === "tenant_site";
        if (e.title !== undefined && !published) {
          ctx.addIssue({ code: "custom", path: ["title"], message: "title is accepted only on marketing and tenant_site" });
        }
        // S12 design §3.4: no ads on client portals or in-app screens, so no ads join key there either.
        for (const k of ["pageId", "nav"] as const) {
          if (e[k] !== undefined && !published) ctx.addIssue({ code: "custom", path: [k], message: `${k} is accepted only on marketing and tenant_site` });
        }
      }),
    "page.leave": pathEvent("page.leave", { activeMs: z.number().int().min(0).max(3_600_000) }),
    "scroll.depth": pathEvent("scroll.depth", { depth: z.union(SCROLL_DEPTHS.map((d) => z.literal(d)) as [z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<75>, z.ZodLiteral<100>]) }),
    "section.read": pathEvent("section.read", { sectionId: SLUG_ID, topic: SLUG_ID.optional() }),
    "cta.click": pathEvent("cta.click", { ctaId: SLUG_ID, destHost: HOST.optional() }),
    "widget.use": pathEvent("widget.use", { widgetId: SLUG_ID, action: z.enum(WIDGET_ACTIONS) }),
    identify: z
      .object({ ...named("identify"), person: z.string().max(70).regex(/^(lead|user):[A-Za-z0-9_-]{1,64}$/), source: z.enum(IDENTIFY_SOURCES) })
      .strict()
      .superRefine((e, ctx) => {
        // §3.3 item 4: a borrower is never a person in this system.
        if (e.surface === "spoke_public") ctx.addIssue({ code: "custom", path: ["surface"], message: "identify is refused on spoke_public" });
      }),
    "screen.opened": z
      .object({ ...namedServer("screen.opened"), route: z.string().max(512) })
      .strict()
      .superRefine((e, ctx) => {
        // §3.1 Rev 2 (GD-2689): route ∈ ROUTES[app], i.e. z.enum(ROUTES[app]) chosen by the event's app.
        if (!enumFor(reg.routes, e.app).safeParse(e.route).success) {
          ctx.addIssue({ code: "custom", path: ["route"], message: `route is not a registered ${e.app} route template` });
        }
      }),
    "feature.used": z
      .object({ ...namedServer("feature.used"), feature: z.string().max(FEATURE_KEY_MAX), count: z.number().int().min(1).max(1000) })
      .strict()
      .superRefine((e, ctx) => {
        if (!enumFor(reg.features, e.app).safeParse(e.feature).success) {
          ctx.addIssue({ code: "custom", path: ["feature"], message: `feature is not registered for ${e.app}` });
        }
      }),
  } as const;
}

export const EVENT_SCHEMAS = buildEventSchemas({ features: FEATURES, routes: ROUTES });

export type TrackingEvent = { [N in EventName]: z.infer<(typeof EVENT_SCHEMAS)[N]> }[EventName];

/** Validate one stored event by its `name`. Unknown names are refused. */
export function parseEvent(input: unknown): { ok: true; event: TrackingEvent } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) return { ok: false, error: "event is not an object" };
  const name = (input as { name?: unknown }).name;
  if (typeof name !== "string" || !(EVENT_NAMES as readonly string[]).includes(name)) {
    return { ok: false, error: "unknown event name" };
  }
  const r = EVENT_SCHEMAS[name as EventName].safeParse(input);
  return r.success ? { ok: true, event: r.data as TrackingEvent } : { ok: false, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
}

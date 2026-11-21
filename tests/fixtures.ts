import { APP_SLUGS } from "@rello-platform/slugs";

export const RELLO = APP_SLUGS[1] satisfies "rello";
export const HOME_SCOUT = APP_SLUGS[5] satisfies "home-scout";

export const common = (over: Record<string, unknown> = {}) => ({
  id: "3f0e8a52-6d1b-4c1e-9a77-2b9d6c0f4e11",
  ts: "2026-11-21T22:30:00.000Z",
  tenantId: "tenant_rello_growth",
  app: RELLO,
  surface: "marketing",
  visitorId: "v_8f2k3j4h5g6",
  sessionId: "s_1a2b3c4d5e6f",
  country: "US",
  region: "UT",
  deviceClass: "desktop",
  ipHash: "0123456789abcdef0123456789abcdef",
  gpc: false,
  ...over,
});

/** One valid event per name. */
export const VALID: Record<string, Record<string, unknown>> = {
  "link.hit": { name: "link.hit", ...common(), rg: "cmp_123", r: "r1.rcp_abc.mac_xyz", uaClass: "browser", asnClass: "residential" },
  "link.scanned": { name: "link.scanned", ...common(), rg: "cmp_123", uaClass: "scanner", asnClass: "security_vendor" },
  "visit.start": { name: "visit.start", ...common(), landingPath: "/pricing", referrerHost: "mail.google.com", utm: { source: "email", campaign: "nov" }, rg: "cmp_123" },
  "page.view": { name: "page.view", ...common(), path: "/pricing", pageType: "pricing", title: "Pricing" },
  "page.leave": { name: "page.leave", ...common(), path: "/pricing", activeMs: 4200 },
  "scroll.depth": { name: "scroll.depth", ...common(), path: "/pricing", depth: 50 },
  "section.read": { name: "section.read", ...common(), path: "/features", sectionId: "arive-export", topic: "arive" },
  "cta.click": { name: "cta.click", ...common(), path: "/pricing", ctaId: "start-trial", destHost: "app.hellorello.app" },
  "widget.use": { name: "widget.use", ...common(), path: "/rates", widgetId: "rate-calculator", action: "change" },
  identify: { name: "identify", ...common({ surface: "in_app" }), person: "lead:clx123abc", source: "sign_in" },
  "screen.opened": { name: "screen.opened", ...common({ surface: "in_app" }), route: "/leads/[id]" },
  "feature.used": { name: "feature.used", ...common({ surface: "in_app" }), feature: "upsell.leads-tab.viewed", count: 1 },
};

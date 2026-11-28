// HOME INSIGHT HI-04 (spec RELLO-HOME-INSIGHT/_SPEC-FEATURE.md §9 HI-04, seam X-29): six Rello screen names.
//
// Rello sends each as `screen.opened.route` from the page or tab that renders it (HI-52, HI-57, HI-61):
//   "/"                        the dashboard (the Home Insight workspace)
//   "/today"                   Today
//   "/leads/home-insight"      Leads › Home Insight. The tab is /leads?tab=home-insight (Rello team/page.tsx:21,41
//   "/team/realtor-prospects"  and the Leads tabs use ?tab=), so the screen gets its own name: a query is never a
//   "/team/performance"        route, and "/leads" or "/team" alone can't tell the tabs apart.
//   "/agent/sponsored"         the sponsored agent view. Sent only once the server has confirmed the viewer holds an
//                              ACTIVE HomeInsightSponsorship (H-8), so the event itself means a sponsored agent.
//
// What these pin: the six are registered; each fits the grammar and passes the package's own screen.opened schema;
// each static template matches itself (first-match order); a lead page still reads as /leads/[id]; and nothing else
// in any registry changed. "/leads/home-insight" sits just before "/leads/[id]": the matchers return the first
// template that matches, so after "/leads/[id]" it could never match itself (registry-rello-s10's rule for every
// app). A lead id is a cuid, never "home-insight", so no real lead page is renamed by it.
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { APP_SLUGS, type AppSlug } from "@rello-platform/slugs";
import { EVENT_SCHEMAS, FEATURES, ROUTES, ROUTE_TEMPLATE_GRAMMAR, matchRoute } from "../src/index";
import { matchTemplate } from "../src/script/core";
import { RELLO } from "./fixtures";

const HOME_INSIGHT_SCREENS = [
  "/",
  "/today",
  "/leads/home-insight",
  "/team/realtor-prospects",
  "/team/performance",
  "/agent/sponsored",
] as const;

/** The five appended at the end, in order ("/leads/home-insight" goes before "/leads/[id]" instead). */
const APPENDED = ["/", "/today", "/team/realtor-prospects", "/team/performance", "/agent/sponsored"] as const;

const h16 = (list: readonly string[]) => createHash("sha256").update(JSON.stringify(list)).digest("hex").slice(0, 16);

/** Every app's v0.8.0 ROUTES and FEATURES, [length, first 16 hex of sha256(JSON)], read from v0.8.0's dist at f95ab6b. */
const V080_ROUTES: Record<AppSlug, readonly [number, string]> = {
  arive: [0, "4f53cda18c2baa0c"],
  rello: [16, "2e3584762ea96f4e"],
  "harvest-home": [2, "86f6b71abfcb24a4"],
  "home-ready": [21, "2021923485067f8b"],
  "home-stretch": [34, "e7cc6553e3a56f32"],
  "home-scout": [47, "8a6956bd5e2dcf8e"],
  "market-intel": [9, "6c6e723e244137a7"],
  "newsletter-studio": [3, "2fc946737b8d1c5c"],
  "the-oven": [22, "1e861b793a26429e"],
  "the-drumbeat": [10, "e98e2ab2e4dfbad8"],
  "open-house-hub": [2, "35cd9ebf58b226b9"],
  "pathfinder-pro": [12, "3f3957840c5e61d8"],
  "prequal-pro": [0, "4f53cda18c2baa0c"],
};
const V080_FEATURES: Record<AppSlug, readonly [number, string]> = {
  arive: [0, "4f53cda18c2baa0c"],
  rello: [11, "5026b2a266d25559"],
  "harvest-home": [33, "4d8719e1e751b612"],
  "home-ready": [33, "fe5252a63854d0a4"],
  "home-stretch": [32, "bc1dd1f915b0ccf8"],
  "home-scout": [10, "991673f8b7f1a111"],
  "market-intel": [31, "34150043a763ef14"],
  "newsletter-studio": [33, "bfcf0caf4efd37ab"],
  "the-oven": [12, "5e1ade81a946358b"],
  "the-drumbeat": [33, "19e03850508681eb"],
  "open-house-hub": [31, "8d73f256b352c094"],
  "pathfinder-pro": [121, "1835f28c4f34ff30"],
  "prequal-pro": [0, "4f53cda18c2baa0c"],
};

/** A screen.opened server event, as Rello's in-app helper builds it. */
const screenOpened = (route: string, app: AppSlug = RELLO) => ({
  name: "screen.opened",
  id: "3f0e8a52-6d1b-4c1e-9a77-2b9d6c0f4e11",
  ts: "2026-11-28T08:00:00.000Z",
  tenantId: "tenant-1",
  app,
  surface: "in_app",
  route,
});

describe("ROUTES.rello registers the six Home Insight screen names (HI-04)", () => {
  test("all six are in ROUTES.rello", () => {
    for (const t of HOME_INSIGHT_SCREENS) expect(ROUTES[RELLO], t).toContain(t);
  });

  test("the list is v0.8.0's, then the five appended in order, with /leads/home-insight just before /leads/[id]", () => {
    const list = ROUTES[RELLO];
    expect(list).toHaveLength(16 + HOME_INSIGHT_SCREENS.length);
    expect(list[list.indexOf("/leads/[id]") - 1]).toBe("/leads/home-insight");
    expect([...list.slice(-APPENDED.length)]).toEqual([...APPENDED]);
    const v080 = list.filter((t) => !(HOME_INSIGHT_SCREENS as readonly string[]).includes(t));
    expect([v080.length, h16(v080)]).toEqual([...V080_ROUTES[RELLO]]);
  });

  test("each fits ROUTE_TEMPLATE_GRAMMAR, and the list repeats none", () => {
    for (const t of HOME_INSIGHT_SCREENS) expect(t, t).toMatch(ROUTE_TEMPLATE_GRAMMAR);
    expect(new Set(ROUTES[RELLO]).size).toBe(ROUTES[RELLO].length);
  });

  test("each matches itself in both matchers (first-match order)", () => {
    for (const t of HOME_INSIGHT_SCREENS) {
      expect(matchRoute(t, ROUTES[RELLO]), t).toBe(t);
      expect(matchTemplate(t, ROUTES[RELLO]), t).toBe(t);
    }
  });

  test("a screen.opened event with each passes the package's own schema", () => {
    for (const route of HOME_INSIGHT_SCREENS) {
      const r = EVENT_SCHEMAS["screen.opened"].safeParse(screenOpened(route));
      expect(r.success, route).toBe(true);
    }
  });

  test("a lead page still reads as /leads/[id]; /agent, a query or an extra segment is still refused", () => {
    for (const id of ["clx9q2w3e0000abcd1234efgh", "jane-doe", "home-insights", "123456"]) {
      expect(matchRoute(`/leads/${id}`, ROUTES[RELLO]), id).toBe("/leads/[id]");
      expect(matchTemplate(`/leads/${id}`, ROUTES[RELLO]), id).toBe("/leads/[id]");
    }
    for (const route of ["/agent", "/leads?tab=home-insight", "/team?tab=performance", "/today/x", "/agent/sponsored/x", "/team/performance/x", ""]) {
      expect(EVENT_SCHEMAS["screen.opened"].safeParse(screenOpened(route)).success, route).toBe(false);
    }
    expect(matchRoute("/agent", ROUTES[RELLO])).toBeUndefined();
    expect(matchRoute("/agent/sponsored/x", ROUTES[RELLO])).toBeUndefined();
  });

  test("no other app gained a screen: each name is refused for another app that never registered it", () => {
    for (const route of ["/today", "/leads/home-insight", "/team/realtor-prospects", "/team/performance", "/agent/sponsored"]) {
      expect(EVENT_SCHEMAS["screen.opened"].safeParse(screenOpened(route, APP_SLUGS[11] satisfies "pathfinder-pro")).success, route).toBe(false);
    }
  });
});

describe("v0.9.0 changes nothing else", () => {
  test("every other app's ROUTES is byte-identical to v0.8.0", () => {
    for (const app of APP_SLUGS) {
      if (app === RELLO) continue;
      expect([ROUTES[app].length, h16(ROUTES[app])], app).toEqual([...V080_ROUTES[app]]);
    }
  });

  test("every app's FEATURES is byte-identical to v0.8.0", () => {
    for (const app of APP_SLUGS) expect([FEATURES[app].length, h16(FEATURES[app])], app).toEqual([...V080_FEATURES[app]]);
  });
});

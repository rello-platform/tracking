// S9 part 3 (Platform KA 1747): Rello's FEATURES and in-app ROUTES.
//
// What these pin: each feature key fits the key grammar and length, each new template fits the
// route grammar, no duplicates, every static template matches itself (the first-match order rule),
// a whole feature.used / screen.opened server event built with each one passes the package's OWN
// schemas (EVENT_SCHEMAS, the real registry, not a fixture), and nothing else changed: an
// unregistered key or a concrete path is still refused, and no other app gained an entry.
import { describe, expect, test } from "vitest";
import { APP_SLUGS } from "@rello-platform/slugs";
import { EVENT_SCHEMAS, FEATURES, FEATURE_KEY_GRAMMAR, FEATURE_KEY_MAX, ROUTES, ROUTE_TEMPLATE_GRAMMAR, matchRoute } from "../src/index";
import { matchTemplate } from "../src/script/core";
import { RELLO } from "./fixtures";

const S9_FEATURES = [
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
] as const;

const S9_SCREENS = [
  "/leads",
  "/campaigns",
  "/campaigns/[id]",
  "/conversations",
  "/calendar",
  "/team",
  "/apps",
  "/broker",
  "/realtor-prospects/[id]",
] as const;

// A whole server event, as the helper builds it (no edge facts: v0.2.0 makes them optional here).
const server = (over: Record<string, unknown>) => ({
  id: "3f0e8a52-6d1b-4c1e-9a77-2b9d6c0f4e11",
  ts: "2026-11-23T17:00:00.000Z",
  tenantId: "tenant-1",
  app: RELLO,
  surface: "in_app",
  ...over,
});

describe("FEATURES.rello (S9 part 3)", () => {
  test("exactly the eleven reviewed keys, in order", () => {
    expect(FEATURES[RELLO]).toEqual([...S9_FEATURES]);
  });

  test("each key fits FEATURE_KEY_GRAMMAR and FEATURE_KEY_MAX, and none repeats", () => {
    for (const f of FEATURES[RELLO]) {
      expect(f, f).toMatch(FEATURE_KEY_GRAMMAR);
      expect(f.length, f).toBeLessThanOrEqual(FEATURE_KEY_MAX);
    }
    expect(new Set(FEATURES[RELLO]).size).toBe(FEATURES[RELLO].length);
  });

  test("a feature.used server event with each key passes the package's own schema", () => {
    for (const feature of S9_FEATURES) {
      const r = EVENT_SCHEMAS["feature.used"].safeParse(server({ name: "feature.used", feature, count: 1 }));
      expect(r.success, feature).toBe(true);
    }
  });

  test("still refused: an unregistered key, a Rello key sent as another app, a free-text value", () => {
    const parse = (over: Record<string, unknown>) => EVENT_SCHEMAS["feature.used"].safeParse(server({ name: "feature.used", count: 1, ...over })).success;
    expect(parse({ feature: "leads.delete" })).toBe(false);
    expect(parse({ feature: "leads.create", app: "home-scout" })).toBe(false);
    expect(parse({ feature: "jane@example.com" })).toBe(false);
  });

  test("no other app registers a feature yet", () => {
    for (const app of APP_SLUGS) if (app !== RELLO) expect(FEATURES[app], app).toEqual([]);
  });
});

describe("ROUTES.rello in-app screens (S9 part 3)", () => {
  test("all nine are registered, after the seven from v0.1.x and S10, which are unchanged", () => {
    expect(ROUTES[RELLO].slice(0, 7)).toEqual([
      "/leads/[id]",
      "/c/dashboard",
      "/c/[token]",
      "/d/[token]",
      "/rate-check/[slug]",
      "/growth/interest/[token]",
      "/signup-link/[token]",
    ]);
    expect(ROUTES[RELLO].slice(7)).toEqual([...S9_SCREENS]);
  });

  test("each passes ROUTE_TEMPLATE_GRAMMAR and none repeats", () => {
    for (const t of S9_SCREENS) expect(t, t).toMatch(ROUTE_TEMPLATE_GRAMMAR);
    expect(new Set(ROUTES[RELLO]).size).toBe(ROUTES[RELLO].length);
  });

  test("each static template matches itself in both matchers (first-match order)", () => {
    for (const t of S9_SCREENS.filter((x) => !x.includes("["))) {
      expect(matchRoute(t, ROUTES[RELLO]), t).toBe(t);
      expect(matchTemplate(t, ROUTES[RELLO]), t).toBe(t);
    }
  });

  test("a screen.opened server event with each template passes the package's own schema", () => {
    for (const route of S9_SCREENS) {
      const r = EVENT_SCHEMAS["screen.opened"].safeParse(server({ name: "screen.opened", route }));
      expect(r.success, route).toBe(true);
    }
  });

  test("a concrete path is never a registered value: refused by the schema", () => {
    for (const route of ["/campaigns/cmp_8f2k3j4h5g6a7b8c", "/realtor-prospects/123456", "/leads/jane-doe", "/leads?tab=closings"]) {
      expect(EVENT_SCHEMAS["screen.opened"].safeParse(server({ name: "screen.opened", route })).success, route).toBe(false);
    }
  });

  test("a concrete path matches its template, so a page that matched would send the template", () => {
    expect(matchRoute("/campaigns/cmp_8f2k3j4h5g6a7b8c", ROUTES[RELLO])).toBe("/campaigns/[id]");
    expect(matchRoute("/realtor-prospects/123456", ROUTES[RELLO])).toBe("/realtor-prospects/[id]");
  });
});

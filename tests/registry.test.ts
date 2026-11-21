import { describe, expect, test } from "vitest";
import { APP_SLUGS } from "@rello-platform/slugs";
import { FEATURES, FEATURE_KEY_GRAMMAR, FEATURE_KEY_MAX, ROUTES, ROUTE_TEMPLATE_GRAMMAR, matchRoute } from "../src/index";
import { RELLO } from "./fixtures";

describe("ROUTES grammar (§3.3 item 2): registered templates only", () => {
  test("every registry is keyed by exactly the canonical app slugs", () => {
    expect(Object.keys(ROUTES).sort()).toEqual([...APP_SLUGS].sort());
    expect(Object.keys(FEATURES).sort()).toEqual([...APP_SLUGS].sort());
  });
  test("every registered template uses only lowercase static words or [camelCaseParam]", () => {
    for (const app of APP_SLUGS) for (const t of ROUTES[app]) expect(t, `${app} ${t}`).toMatch(ROUTE_TEMPLATE_GRAMMAR);
  });
  test("the grammar refuses a concrete value so it cannot be registered by mistake", () => {
    for (const t of ["/leads/12345", "/leads/clx9q2w3e0000abcd1234efgh", "/leads/3f0e8a52-6d1b-4c1e-9a77-2b9d6c0f4e11", "/u/jane@example.com", "/leads/[Id]", "/leads/[id", "leads/[id]", "/leads//[id]", "/Leads"]) {
      expect(ROUTE_TEMPLATE_GRAMMAR.test(t), t).toBe(false);
    }
    expect(ROUTE_TEMPLATE_GRAMMAR.test("/leads/[id]")).toBe(true);
    expect(ROUTE_TEMPLATE_GRAMMAR.test("/")).toBe(true);
  });
  test("every registered feature key fits its grammar and bound", () => {
    for (const app of APP_SLUGS) for (const f of FEATURES[app]) {
      expect(f).toMatch(FEATURE_KEY_GRAMMAR);
      expect(f.length).toBeLessThanOrEqual(FEATURE_KEY_MAX);
    }
  });
  test("templates are unique per app", () => {
    for (const app of APP_SLUGS) expect(new Set(ROUTES[app]).size).toBe(ROUTES[app].length);
  });
});

describe("matchRoute (§3.2): each [param] matches exactly one segment", () => {
  const t = ROUTES[RELLO];
  test("matches the template, never echoes the URL", () => {
    expect(matchRoute("/leads/clx9q2w3e0000abcd1234efgh", t)).toBe("/leads/[id]");
    expect(matchRoute("/c/8f2k3j4h5g6a7b8c9d0e", t)).toBe("/c/[token]");
  });
  test("no match for extra, missing or empty segments", () => {
    expect(matchRoute("/leads", t)).toBeUndefined();
    expect(matchRoute("/leads/", t)).toBeUndefined();
    expect(matchRoute("/leads/a/b", t)).toBeUndefined();
    expect(matchRoute("leads/a", t)).toBeUndefined();
    expect(matchRoute("/settings", t)).toBeUndefined();
  });
});

import { describe, expect, test } from "vitest";
import { z } from "zod";
import { APP_SLUGS, type AppSlug } from "@rello-platform/slugs";
import {
  EVENT_NAMES,
  EVENT_SCHEMAS,
  ROUTES,
  buildEventSchemas,
  findNonStrictObjects,
  findUnboundedStrings,
  parseEvent,
} from "../src/index";
import { HOME_SCOUT, RELLO, VALID, common } from "./fixtures";

// A fixture feature registry, so an ACCEPTED feature.used can be exercised: v0.1.0
// registers no features (S9/S11 add them), so the package's own FEATURES refuses all.
const featuresFixture = Object.fromEntries(APP_SLUGS.map((a) => [a, a === RELLO ? ["upsell.leads-tab.viewed"] : []])) as {
  readonly [A in AppSlug]: readonly string[];
};
const WITH_FEATURE = buildEventSchemas({ features: featuresFixture, routes: ROUTES });
const schemaFor = (name: string) => (name === "feature.used" ? WITH_FEATURE : EVENT_SCHEMAS)[name as keyof typeof EVENT_SCHEMAS];

describe("the 12 events (plan §3.1)", () => {
  test("12 of 12 event names have a schema", () => {
    expect(EVENT_NAMES).toHaveLength(12);
    expect(Object.keys(EVENT_SCHEMAS).sort()).toEqual([...EVENT_NAMES].sort());
    expect(Object.keys(VALID).sort()).toEqual([...EVENT_NAMES].sort());
  });

  for (const name of EVENT_NAMES) {
    test(`${name}: a valid event is accepted`, () => {
      const r = schemaFor(name).safeParse(VALID[name]);
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    });
    test(`${name}: an extra key is refused (.strict())`, () => {
      expect(schemaFor(name).safeParse({ ...VALID[name], props: { note: "x" } }).success).toBe(false);
      expect(schemaFor(name).safeParse({ ...VALID[name], metadata: "x" }).success).toBe(false);
    });
  }

  test("parseEvent refuses an unknown name and a non-object", () => {
    expect(parseEvent({ ...VALID["page.view"], name: "page.viewed" }).ok).toBe(false);
    expect(parseEvent(null).ok).toBe(false);
    expect(parseEvent(VALID["page.view"]).ok).toBe(true);
  });
});

describe("screen.opened: route ∈ ROUTES[app] (§3.1 Rev 2, GD-2689)", () => {
  const opened = (route: string, app: string = RELLO) => EVENT_SCHEMAS["screen.opened"].safeParse({ ...VALID["screen.opened"], app, route });

  test("accepts /leads/[id] registered under rello", () => {
    expect(ROUTES[RELLO]).toContain("/leads/[id]");
    expect(opened("/leads/[id]").success).toBe(true);
  });

  test.each([
    ["a numeric id", "/leads/12345"],
    ["a name", "/leads/jane-doe"],
    ["a cuid", "/leads/clx9q2w3e0000abcd1234efgh"],
    ["a UUID", "/leads/3f0e8a52-6d1b-4c1e-9a77-2b9d6c0f4e11"],
  ])("refuses %s (%s)", (_label, route) => {
    expect(opened(route).success).toBe(false);
  });

  test("a template registered under one app is refused for another", () => {
    expect(ROUTES[HOME_SCOUT]).not.toContain("/leads/[id]");
    expect(opened("/leads/[id]", HOME_SCOUT).success).toBe(false);
  });
});

describe("feature.used: feature ∈ FEATURES[app]", () => {
  test("refused when the app registers nothing (v0.1.0 default)", () => {
    expect(EVENT_SCHEMAS["feature.used"].safeParse(VALID["feature.used"]).success).toBe(false);
  });
  test("accepted only when registered; count bounded 1–1000", () => {
    expect(WITH_FEATURE["feature.used"].safeParse(VALID["feature.used"]).success).toBe(true);
    expect(WITH_FEATURE["feature.used"].safeParse({ ...VALID["feature.used"], feature: "upsell.other" }).success).toBe(false);
    expect(WITH_FEATURE["feature.used"].safeParse({ ...VALID["feature.used"], count: 0 }).success).toBe(false);
    expect(WITH_FEATURE["feature.used"].safeParse({ ...VALID["feature.used"], count: 1001 }).success).toBe(false);
  });
});

describe("paths (§3.2) and surfaces (§3.3)", () => {
  const view = (over: Record<string, unknown>) => EVENT_SCHEMAS["page.view"].safeParse({ ...VALID["page.view"], ...common(over), name: "page.view", pageType: "portal", ...over });

  test("spoke_public sends the registered template, never the URL", () => {
    expect(view({ surface: "spoke_public", path: "/c/[token]", title: undefined }).success).toBe(true);
    expect(view({ surface: "spoke_public", path: "/c/8f2k3j4h5g6a7b8c9d0e", title: undefined }).success).toBe(false);
  });
  test("spoke_public with no matching template sends no path, and is accepted", () => {
    const { path: _p, title: _t, ...rest } = VALID["page.view"];
    expect(EVENT_SCHEMAS["page.view"].safeParse({ ...rest, surface: "spoke_public" }).success).toBe(true);
  });
  test("marketing must carry a path, with id-shaped segments already masked", () => {
    const { path: _p, ...rest } = VALID["page.view"];
    expect(EVENT_SCHEMAS["page.view"].safeParse(rest).success).toBe(false);
    expect(view({ path: "/u/123456" }).success).toBe(false);
    expect(view({ path: "/u/jane@example.com" }).success).toBe(false);
    expect(view({ path: "/u/:id" }).success).toBe(true);
  });
  test("title only on marketing and tenant_site; ≤ 120", () => {
    expect(view({ surface: "in_app", path: "/leads/[id]", title: "Jane Doe" }).success).toBe(false);
    expect(view({ title: "x".repeat(121) }).success).toBe(false);
  });
  test("identify is refused on spoke_public", () => {
    expect(EVENT_SCHEMAS.identify.safeParse({ ...VALID.identify, surface: "spoke_public" }).success).toBe(false);
  });
  test("a query string or fragment never passes as a path", () => {
    expect(view({ path: "/pricing?email=a@b.c" }).success).toBe(false);
    expect(view({ path: "/pricing#x" }).success).toBe(false);
  });
});

describe("package guards (§3.3 item 5)", () => {
  test("no event schema has an unbounded string", () => {
    for (const name of EVENT_NAMES) expect(findUnboundedStrings(EVENT_SCHEMAS[name]), name).toEqual([]);
  });
  test("every object in every event schema is strict", () => {
    for (const name of EVENT_NAMES) expect(findNonStrictObjects(EVENT_SCHEMAS[name]), name).toEqual([]);
  });
  test("an unbounded string fails the string guard", () => {
    const bad = z.object({ ok: z.string().max(10), note: z.string(), nested: z.object({ deep: z.string().regex(/^a/) }).strict().optional() }).strict();
    expect(findUnboundedStrings(bad)).toEqual(["note", "nested.deep"]);
  });
  test("a non-strict object fails the strict guard", () => {
    const bad = z.object({ a: z.string().max(1), inner: z.object({ b: z.string().max(1) }) }).strict();
    expect(findNonStrictObjects(bad)).toEqual(["inner"]);
  });
});

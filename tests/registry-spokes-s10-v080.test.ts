// v0.8.0 (S10 prep for U16 / U17 / U18, Platform KA prompt 2022; plan §11 S10, STATUS-S9-S11 rows U16–U18):
// the page templates for Home Scout's agent pages and homeowner hub, HomeReady's agent page + lead pages, and
// The Home Stretch's client portal.
//
// ADDED below is written out by hand from each repo's main by the prompt's one rule (see the comment above each list
// in src/registry.ts), not read from src/registry.ts, so it pins the rule's outcome:
//   home-scout   The-Home-Scout @ fcbb6ee0: every page.tsx under src/app/(public)/[agentSlug]/** and
//                src/app/(owner)/[agentSlug]/**; route groups and the leading [agentSlug] dropped; [pageSlug]/preview
//                and /embed left out; "/tools" already registered (v0.5.0), so not added twice.
//   home-ready   HomeReady @ 4c97a28d: the landing pages the subdomain rewrite serves ("/", "/login") + the two lead pages.
//   home-stretch TheHomeStretch @ 4d95dd3b: every page.tsx under src/app/portal/.
// Every v0.7.0 entry of every app stays byte-identical and first; the new templates are appended after it.
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { APP_SLUGS, type AppSlug } from "@rello-platform/slugs";
import { EVENT_SCHEMAS, ROUTES, ROUTE_TEMPLATE_GRAMMAR, matchRoute } from "../src/index";
import { matchTemplate } from "../src/script/core";
import { common } from "./fixtures";

const HOME_READY = APP_SLUGS[3] satisfies "home-ready";
const HOME_STRETCH = APP_SLUGS[4] satisfies "home-stretch";
const HOME_SCOUT = APP_SLUGS[5] satisfies "home-scout";
const THREE = [HOME_SCOUT, HOME_READY, HOME_STRETCH] as const;

const ADDED: Record<(typeof THREE)[number], readonly string[]> = {
  [HOME_SCOUT]: [
    "/", "/newsletter", "/realtors", "/home", "/tours", "/do-not-sell", "/privacy", "/terms", "/[pageSlug]",
    "/home/auth", "/realtors/assistance", "/realtors/budget", "/realtors/library",
    "/tools/book-a-call", "/tools/browse-homes", "/tools/buying-power", "/tools/cash-out-calculator", "/tools/compare-options",
    "/tools/contact-form", "/tools/get-pre-approved", "/tools/get-pre-approved-bank-statement", "/tools/get-pre-approved-dscr",
    "/tools/get-pre-approved-hecm", "/tools/get-pre-approved-va", "/tools/net-sheet", "/tools/qualify", "/tools/referral",
    "/tools/refi-calculator", "/tools/upcoming-open-houses", "/tools/[toolSlug]", "/tours/[tourId]",
    "/realtors/sheets/[sheetId]", "/tools/book-a-call/[meetingTypeSlug]", "/tools/book-a-call/[meetingTypeSlug]/confirm",
  ],
  [HOME_READY]: ["/", "/login", "/portal/[leadId]", "/results/[leadId]"],
  [HOME_STRETCH]: [
    "/portal/calculators", "/portal/daily", "/portal/dashboard", "/portal/dream-profile", "/portal/invite", "/portal/journey",
    "/portal/login", "/portal/onboarding", "/portal/plans", "/portal/points", "/portal/profile", "/portal/savings",
    "/portal/track-selection", "/portal/verify", "/portal/weekly",
    "/portal/legal/accessibility", "/portal/legal/communications", "/portal/legal/disclosures", "/portal/legal/do-not-sell",
    "/portal/legal/notice-at-collection", "/portal/legal/privacy", "/portal/legal/terms",
    "/portal/plans/credit", "/portal/plans/debts", "/portal/plans/down-payment", "/portal/plans/income", "/portal/plans/savings",
    "/portal/journey/[moduleId]",
  ],
};

// v0.7.0 (tag object b29dfd70 → cd79bfad), measured from that commit's src/registry.ts: [count, sha256(JSON)[:16]].
// The three apps above are checked on their first <count> entries; every other app on its whole list.
const V070: Record<AppSlug, readonly [number, string]> = {
  arive: [0, "4f53cda18c2baa0c"],
  rello: [16, "2e3584762ea96f4e"],
  "harvest-home": [2, "86f6b71abfcb24a4"],
  "home-ready": [17, "baa7d16dd27d8832"],
  "home-stretch": [6, "d8fb283a85909a7f"],
  "home-scout": [13, "36a10e175477fe41"],
  "market-intel": [9, "6c6e723e244137a7"],
  "newsletter-studio": [3, "2fc946737b8d1c5c"],
  "the-oven": [22, "1e861b793a26429e"],
  "the-drumbeat": [10, "e98e2ab2e4dfbad8"],
  "open-house-hub": [2, "35cd9ebf58b226b9"],
  "pathfinder-pro": [12, "3f3957840c5e61d8"],
  "prequal-pro": [0, "4f53cda18c2baa0c"],
} as Record<AppSlug, readonly [number, string]>;
const h16 = (list: readonly string[]) => createHash("sha256").update(JSON.stringify(list)).digest("hex").slice(0, 16);

/** A concrete path for a template: each [param] becomes the given value. */
const sample = (t: string, v: string) => t.replace(/\[[a-zA-Z]+\]/g, v);
const VALUES = ["clx9q2w3e0000abcd1234efgh", "jane-doe", "123456"];

/** A spoke_public page.view carrying `path`, as the engine stamps it (tenant + host-derived app). */
const pageView = (app: AppSlug, path: string) =>
  EVENT_SCHEMAS["page.view"].safeParse({ name: "page.view", ...common({ app, surface: "spoke_public", tenantId: "tenant-1" }), path, pageType: "other" });

describe("v0.8.0 appends exactly the S10 templates, and nothing else changes", () => {
  test("each of the three apps = its v0.7.0 list, unchanged and first, then exactly its ADDED templates, in order", () => {
    for (const app of THREE) {
      const [n, hash] = V070[app];
      expect(h16(ROUTES[app].slice(0, n)), `${app} v0.7.0 entries`).toBe(hash);
      expect([...ROUTES[app].slice(n)], `${app} added`).toEqual([...ADDED[app]]);
    }
  });

  test("the counts: home-scout 34 added (13 → 47), home-ready 4 (17 → 21), home-stretch 28 (6 → 34)", () => {
    expect([ADDED[HOME_SCOUT].length, ADDED[HOME_READY].length, ADDED[HOME_STRETCH].length]).toEqual([34, 4, 28]);
    expect([ROUTES[HOME_SCOUT].length, ROUTES[HOME_READY].length, ROUTES[HOME_STRETCH].length]).toEqual([47, 21, 34]);
  });

  test("every other app's list is byte-identical to v0.7.0", () => {
    for (const app of APP_SLUGS) {
      if ((THREE as readonly string[]).includes(app)) continue;
      expect([ROUTES[app].length, h16(ROUTES[app])], app).toEqual([...V070[app]]);
    }
  });

  test("every added template fits ROUTE_TEMPLATE_GRAMMAR and no list repeats a template", () => {
    for (const app of THREE) {
      for (const t of ADDED[app]) expect(t, `${app} ${t}`).toMatch(ROUTE_TEMPLATE_GRAMMAR);
      expect(new Set(ROUTES[app]).size, app).toBe(ROUTES[app].length);
    }
  });

  test("the rule's exclusions: no preview page, no /embed, the agent segment never appears", () => {
    const hs = ROUTES[HOME_SCOUT];
    // ("/embeds" is Home Scout's v0.5.0 in-app screen, not an /embed page: hence the exact segment test.)
    expect(hs.filter((t) => t.endsWith("/preview") || t === "/embed" || t.startsWith("/embed/") || t.includes("[agentSlug]"))).toEqual([]);
    expect(matchRoute("/spring-open-house/preview", hs)).toBeUndefined();
    expect(matchRoute("/embed/jane-doe/buying-power", hs)).toBeUndefined();
    expect(ROUTES[HOME_READY].filter((t) => t.startsWith("/landing"))).toEqual([]);
  });
});

describe("each new template matches its own sample path and is stored as itself", () => {
  test("matchRoute and the page script's matchTemplate both return the template, for three value shapes", () => {
    for (const app of THREE) {
      for (const t of ADDED[app]) {
        for (const v of VALUES) {
          const path = sample(t, v);
          expect(matchRoute(path, ROUTES[app]), `${app} ${path}`).toBe(t);
          expect(matchTemplate(path, ROUTES[app]), `${app} ${path}`).toBe(t);
        }
      }
    }
  });

  test("a spoke_public page.view with the template as its path is accepted (stored as the template)", () => {
    for (const app of THREE) for (const t of ADDED[app]) expect(pageView(app, t).success, `${app} ${t}`).toBe(true);
  });

  test("the concrete path is never accepted as a path value (the template is stored, never the URL)", () => {
    for (const app of THREE) {
      for (const t of ADDED[app].filter((x) => x.includes("["))) {
        expect(pageView(app, sample(t, "clx9q2w3e0000abcd1234efgh")).success, `${app} ${t}`).toBe(false);
      }
    }
  });

  test("a template is accepted only for its own app (home-scout's agent pages are not home-ready's)", () => {
    expect(pageView(HOME_READY, "/tools/buying-power").success).toBe(false);
    expect(pageView(HOME_SCOUT, "/portal/[leadId]").success).toBe(false);
    expect(pageView(HOME_STRETCH, "/[pageSlug]").success).toBe(false);
  });
});

describe("first match wins: a static template beats a [param] template at the same depth", () => {
  test("matchRoute walks the list in order and returns the FIRST template whose segments all fit", () => {
    expect(matchRoute("/x", ["/[a]", "/x"])).toBe("/[a]");
    expect(matchRoute("/x", ["/x", "/[a]"])).toBe("/x");
  });

  test("the named pairs: static before its [param] sibling, and each static matches itself", () => {
    const pairs: [AppSlug, string, string][] = [
      [HOME_SCOUT, "/newsletter", "/[pageSlug]"],
      [HOME_SCOUT, "/realtors", "/[pageSlug]"],
      [HOME_SCOUT, "/tools", "/[pageSlug]"],
      [HOME_SCOUT, "/tools/buying-power", "/tools/[toolSlug]"],
      [HOME_SCOUT, "/tools/book-a-call", "/tools/[toolSlug]"],
      [HOME_STRETCH, "/portal/journey", "/portal/journey/[moduleId]"],
    ];
    for (const [app, s, p] of pairs) {
      const L = ROUTES[app];
      expect(L.indexOf(s), `${app} ${s}`).toBeGreaterThanOrEqual(0);
      expect(L.indexOf(s), `${app} ${s} before ${p}`).toBeLessThan(L.indexOf(p));
      expect(matchRoute(s, L), `${app} ${s}`).toBe(s);
      expect(matchTemplate(s, L), `${app} ${s}`).toBe(s);
    }
  });

  test("in every full list, every static template matches itself (nothing is shadowed)", () => {
    for (const app of THREE) {
      for (const t of ROUTES[app].filter((x) => !x.includes("["))) {
        expect(matchRoute(t, ROUTES[app]), `${app} ${t}`).toBe(t);
        expect(matchTemplate(t, ROUTES[app]), `${app} ${t}`).toBe(t);
      }
    }
  });

  test("every v0.7.0 template of the three apps still matches its own sample paths in the full list", () => {
    for (const app of THREE) {
      for (const t of ROUTES[app].slice(0, V070[app][0])) {
        for (const v of VALUES) {
          expect(matchRoute(sample(t, v), ROUTES[app]), `${app} ${sample(t, v)}`).toBe(t);
          expect(matchTemplate(sample(t, v), ROUTES[app]), `${app} ${sample(t, v)}`).toBe(t);
        }
      }
    }
  });
});

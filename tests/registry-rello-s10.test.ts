/**
 * PLATFORM-TRACKING-SYSTEM S10 (Rello's public pages, Platform KA 1664): the four templates Rello
 * registers so its public pages can send a template instead of the URL (plan §3.2).
 *
 * Each case maps a value shaped exactly as Rello mints it to its template, through both matchers:
 * `matchRoute` (the registry's, used at intake) and `matchTemplate` (the one bundled into the page
 * script, src/script/core.ts). The mint expressions are copied from Rello, with their source:
 *   - /growth/interest/<token>: randomBytes(32).toString("base64url")  (src/lib/growth/nibble-interest-token.ts mintInterestToken)
 *   - /signup-link/<token>:     `rello_ml_${randomBytes(32).toString("hex")}`  (src/lib/auth/oidc/tokens.ts:190, src/lib/auth/utils.ts generateToken)
 *   - /rate-check/<slug>:       a person's slug, first-last  (src/lib/agents/queries.ts generateSlug; cta.ts uses the MLO's user slug)
 *   - /c/<token>:               randomBytes(32).toString("hex")  (src/lib/closing/client-portal-session.ts issueClientPortalSession)
 */
import { randomBytes } from "node:crypto";
import { describe, expect, test } from "vitest";
import { ROUTES, ROUTE_TEMPLATE_GRAMMAR, matchRoute } from "../src/index";
import { matchTemplate } from "../src/script/core";
import { RELLO } from "./fixtures";

const S10_TEMPLATES = ["/rate-check/[slug]", "/growth/interest/[token]", "/signup-link/[token]", "/c/dashboard"] as const;

const minted = (): Array<[string, string]> => [
  [`/growth/interest/${randomBytes(32).toString("base64url")}`, "/growth/interest/[token]"],
  [`/signup-link/rello_ml_${randomBytes(32).toString("hex")}`, "/signup-link/[token]"],
  ["/rate-check/jane-doe", "/rate-check/[slug]"],
  ["/rate-check/smith-mortgage-team", "/rate-check/[slug]"],
  ["/c/dashboard", "/c/dashboard"],
  [`/c/${randomBytes(32).toString("hex")}`, "/c/[token]"],
  [`/d/${randomBytes(32).toString("hex")}`, "/d/[token]"],
];

describe("Rello's S10 templates", () => {
  test("all four are registered for rello, and the v0.1.1 templates are all still there", () => {
    for (const t of S10_TEMPLATES) expect(ROUTES[RELLO], t).toContain(t);
    for (const t of ["/leads/[id]", "/c/[token]", "/d/[token]"]) expect(ROUTES[RELLO], t).toContain(t);
    expect(ROUTES[RELLO]).toHaveLength(7);
  });

  test("each passes ROUTE_TEMPLATE_GRAMMAR", () => {
    for (const t of S10_TEMPLATES) expect(t, t).toMatch(ROUTE_TEMPLATE_GRAMMAR);
  });

  test("a value minted the way Rello mints it maps to its template, in the registry matcher and in the script's", () => {
    for (let i = 0; i < 100; i++) {
      for (const [path, template] of minted()) {
        expect(matchRoute(path, ROUTES[RELLO]), path).toBe(template);
        expect(matchTemplate(path, ROUTES[RELLO]), path).toBe(template);
      }
    }
  });

  test("first match wins in both matchers, so every static template matches itself (none is shadowed by a [param])", () => {
    for (const app of Object.keys(ROUTES) as Array<keyof typeof ROUTES>) {
      for (const t of ROUTES[app].filter((x) => !x.includes("["))) {
        expect(matchRoute(t, ROUTES[app]), `${app} ${t}`).toBe(t);
        expect(matchTemplate(t, ROUTES[app]), `${app} ${t}`).toBe(t);
      }
    }
  });

  test("no S10 page path with an extra or missing segment matches", () => {
    for (const p of ["/rate-check", "/rate-check/", "/rate-check/jane-doe/x", "/growth/interest", "/signup-link/a/b", "/c/dashboard/x"]) {
      expect(matchRoute(p, ROUTES[RELLO]), p).toBeUndefined();
    }
  });
});

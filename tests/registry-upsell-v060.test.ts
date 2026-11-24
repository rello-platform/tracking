// U21 (Platform KA 1884; plan marker S11B-KA1881): the `upsell.<seam>.<event>` feature keys for the eight
// apps that sell Rello an upgrade. Slice S11 moves the spokes' upsell telemetry (hub AuditLog PlatformSignal
// rows named `<app>.upsell.<seam>.<event>`) to the engine as `feature.used` with feature = `upsell.<seam>.<event>`,
// and Growth's engine read turns (app, feature) back into the hub name by putting `<app>.` in front.
//
// The tables below are written by hand from the sources of record, not read from src/registry.ts, so a wrong
// registry cannot make its own test pass:
//   - SEAMS: Rello's UPSELL_SEAMS (src/lib/upsell/seam-registry.ts @ Rello main 9fd58f997), 25 seams in 8 apps.
//   - EVENTS: @rello-platform/ui UPSELL_EVENTS (src/components/rello-upsell-nudge/events.ts).
//   - FAMILY: @rello-platform/signals v0.41.0 (the tag Rello pins) registers `<app>.upsell.` as a PREFIX FAMILY
//     for the eight UPSELL_SOURCE_APPS, and names no seam or event: seams and events come from the two above.
//   - CONVERTED: Rello's CONVERTED_SIGNAL_PATTERN (src/lib/billing/trial-start/converted-signal.ts:45).
// Each app is keyed by its canonical slug from @rello-platform/slugs, by index with `satisfies`.
import { describe, expect, test } from "vitest";
import { APP_SLUGS, type AppSlug } from "@rello-platform/slugs";
import { EVENT_SCHEMAS, FEATURES, FEATURE_KEY_GRAMMAR, FEATURE_KEY_MAX } from "../src/index";

const RELLO = APP_SLUGS[1] satisfies "rello";
const HARVEST_HOME = APP_SLUGS[2] satisfies "harvest-home";
const HOME_READY = APP_SLUGS[3] satisfies "home-ready";
const HOME_STRETCH = APP_SLUGS[4] satisfies "home-stretch";
const HOME_SCOUT = APP_SLUGS[5] satisfies "home-scout";
const MARKET_INTEL = APP_SLUGS[6] satisfies "market-intel";
const NEWSLETTER_STUDIO = APP_SLUGS[7] satisfies "newsletter-studio";
const THE_OVEN = APP_SLUGS[8] satisfies "the-oven";
const THE_DRUMBEAT = APP_SLUGS[9] satisfies "the-drumbeat";
const OPEN_HOUSE_HUB = APP_SLUGS[10] satisfies "open-house-hub";
const PATHFINDER_PRO = APP_SLUGS[11] satisfies "pathfinder-pro";

const EVENTS = ["shown", "engaged", "dismissed", "clicked", "converted"] as const;

const SEAMS: Record<string, readonly string[]> = {
  [HARVEST_HOME]: ["property-watch-trigger", "dashboard-hot-leads", "score-cold-lead-rescue"],
  [HOME_READY]: ["lead-ready-threshold", "journey-cadence-config", "pillar-blocker-insight"],
  [HOME_STRETCH]: ["pre-approval-readiness-achieved", "journey-complete-graduation", "stall-detected-re-engagement"],
  [NEWSLETTER_STUDIO]: ["newsletter-multi-channel-orchestration", "analytics-cross-app-intelligence", "audience-expansion-via-multi-source-leads"],
  [OPEN_HOUSE_HUB]: ["hot-lead-alert-silence", "conversion-funnel-wall", "neighbor-referral-orphan"],
  [MARKET_INTEL]: ["content-repurposing", "send-performance-analytics", "subscriber-segmentation-advanced"],
  [PATHFINDER_PRO]: ["multi-channel-borrower-touch", "post-export-revenue-attribution", "pre-intake-nurture-history", "agent-events-locked"],
  [THE_DRUMBEAT]: ["auto-task-hot-lead", "full-timeline", "pages-create-custom"],
};

const EIGHT = Object.keys(SEAMS) as AppSlug[];

/** The hub signal name for (app, seam, event): what a spoke writes to AuditLog today. */
const hubName = (app: string, seam: string, event: string) => `${app}.upsell.${seam}.${event}`;
/** Rello's converted-signal shape, copied from converted-signal.ts:45. */
const CONVERTED = /^[a-z0-9]+(?:-[a-z0-9]+)*\.upsell\.[a-z0-9]+(?:-[a-z0-9]+)*\.converted$/;

const expectedKeys = (app: string) => SEAMS[app].flatMap((seam) => EVENTS.map((event) => `upsell.${seam}.${event}`));
const upsellOf = (app: AppSlug) => FEATURES[app].filter((k) => k.startsWith("upsell."));

const featureOk = (app: string, feature: string) =>
  EVENT_SCHEMAS["feature.used"].safeParse({
    id: "3f0e8a52-6d1b-4c1e-9a77-2b9d6c0f4e11",
    ts: "2026-11-24T17:00:00.000Z",
    tenantId: "tenant-1",
    surface: "in_app",
    name: "feature.used",
    app,
    feature,
    count: 1,
  }).success;

describe("the eight upsell source apps register their upsell keys", () => {
  test("the eight are distinct canonical slugs, and Rello, home-scout, the-oven, arive and prequal-pro are not among them", () => {
    expect(EIGHT).toHaveLength(8);
    expect(new Set(EIGHT).size).toBe(8);
    for (const app of EIGHT) expect(APP_SLUGS as readonly string[], app).toContain(app);
    for (const out of [RELLO, HOME_SCOUT, THE_OVEN, "arive", "prequal-pro"]) expect(EIGHT as string[], out).not.toContain(out);
  });

  test("the seam table is Rello's: 25 seams, 3 per app and 4 for pathfinder-pro", () => {
    expect(EIGHT.reduce((n, a) => n + SEAMS[a].length, 0)).toBe(25);
    for (const app of EIGHT) expect(SEAMS[app].length, app).toBe(app === PATHFINDER_PRO ? 4 : 3);
  });

  test("each app registers exactly seam × event, 5 events per seam: 15 keys (pathfinder-pro 20), 125 in all", () => {
    for (const app of EIGHT) expect(upsellOf(app), app).toEqual(expectedKeys(app));
    expect(EIGHT.reduce((n, a) => n + upsellOf(a).length, 0)).toBe(125);
  });

  test("every seam gets all five events, converted included", () => {
    for (const app of EIGHT) for (const seam of SEAMS[app]) for (const event of EVENTS) expect(FEATURES[app], `${app} ${seam} ${event}`).toContain(`upsell.${seam}.${event}`);
  });

  test("the upsell keys come after every earlier key: the v0.5.0 entries are a prefix", () => {
    for (const app of EIGHT) {
      const all = FEATURES[app];
      const firstUpsell = all.findIndex((k) => k.startsWith("upsell."));
      expect(firstUpsell, app).toBeGreaterThan(0);
      expect(all.slice(firstUpsell), app).toEqual(expectedKeys(app));
      expect(all.slice(0, firstUpsell).some((k) => k.startsWith("upsell.")), app).toBe(false);
    }
  });

  test("no other app registers an upsell key: not rello, home-scout, the-oven, arive or prequal-pro", () => {
    for (const app of APP_SLUGS) {
      if ((EIGHT as readonly string[]).includes(app)) continue;
      expect(upsellOf(app), app).toEqual([]);
    }
  });

  test("no key is an audit-family name (<app>.audit.upsell-nudge.* is not part of S11)", () => {
    for (const app of EIGHT) for (const k of FEATURES[app]) expect(k, `${app} ${k}`).not.toMatch(/audit|nudge/);
  });

  test("a surface or event outside the table is not registered (menu-item, trial-banner, upgrade-page, a locked-feature surface, an unknown event)", () => {
    for (const app of EIGHT) {
      for (const k of ["upsell.menu-item.shown", "upsell.menu-item.clicked", "upsell.trial-banner.shown", "upsell.upgrade-page.shown", "upsell.upgrade-page.clicked", "upsell.quick-quote.shown", `upsell.${SEAMS[app][0]}.opened`, "upsell.shown", "upsell"]) {
        expect(FEATURES[app], `${app} ${k}`).not.toContain(k);
        expect(featureOk(app, k), `${app} ${k}`).toBe(false);
      }
    }
  });
});

describe("every upsell key: accepted for its own app, refused for every other app", () => {
  test("accepted as feature.used for its own app", () => {
    for (const app of EIGHT) for (const k of expectedKeys(app)) expect(featureOk(app, k), `${app} ${k}`).toBe(true);
  });

  test("refused for every other app, the other seven and the three that sell nothing included", () => {
    for (const app of EIGHT) {
      for (const k of expectedKeys(app)) {
        for (const other of APP_SLUGS) {
          if (other === app) continue;
          expect(featureOk(other, k), `${k} sent as ${other}`).toBe(false);
        }
      }
    }
  });

  test("a seam of one app is never registered under another (no seam name is shared)", () => {
    const seen = new Map<string, string>();
    for (const app of EIGHT) for (const seam of SEAMS[app]) {
      expect(seen.has(seam), `${seam} (${app}) also in ${seen.get(seam)}`).toBe(false);
      seen.set(seam, app);
    }
  });
});

describe("the mapping to the hub name is exact and lossless, both ways", () => {
  test("forward: the hub name minus '<app>.' is a registered key, for every app, seam and event", () => {
    for (const app of EIGHT) for (const seam of SEAMS[app]) for (const event of EVENTS) {
      const hub = hubName(app, seam, event);
      expect(hub.startsWith(`${app}.`), hub).toBe(true);
      expect(FEATURES[app], hub).toContain(hub.slice(app.length + 1));
    }
  });

  test("backward: '<app>.' + a registered key is a hub name in the app's signals family, and parses back to a known seam and event", () => {
    for (const app of EIGHT) {
      expect(upsellOf(app).length, `${app} has upsell keys to walk`).toBe(expectedKeys(app).length);
      for (const key of upsellOf(app)) {
        const hub = `${app}.${key}`;
        expect(hub.startsWith(`${app}.upsell.`), hub).toBe(true);
        const m = /^upsell\.([a-z0-9]+(?:-[a-z0-9]+)*)\.([a-z]+)$/.exec(key);
        expect(m, hub).not.toBeNull();
        expect(SEAMS[app], hub).toContain(m![1]);
        expect(EVENTS as readonly string[], hub).toContain(m![2]);
        expect(hubName(app, m![1], m![2]), hub).toBe(hub);
      }
    }
  });

  test("every converted key becomes the name Rello's trial-start writes", () => {
    for (const app of EIGHT) for (const seam of SEAMS[app]) {
      expect(CONVERTED.test(`${app}.upsell.${seam}.converted`), `${app} ${seam}`).toBe(true);
      expect(FEATURES[app], `${app} ${seam}`).toContain(`upsell.${seam}.converted`);
    }
  });
});

describe("the registry grammar accepts every new key", () => {
  test("each key fits FEATURE_KEY_GRAMMAR and FEATURE_KEY_MAX, and none repeats within an app", () => {
    for (const app of EIGHT) {
      expect(upsellOf(app).length, `${app} has upsell keys to walk`).toBe(expectedKeys(app).length);
      for (const k of upsellOf(app)) {
        expect(k, `${app} ${k}`).toMatch(FEATURE_KEY_GRAMMAR);
        expect(k.length, `${app} ${k}`).toBeLessThanOrEqual(FEATURE_KEY_MAX);
      }
      expect(new Set(FEATURES[app]).size, `${app} features`).toBe(FEATURES[app].length);
    }
  });
});

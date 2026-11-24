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
//   - SURFACES (KA 1885, which widens the vocabulary): every <surface>.<event> pair an app emits on its main today,
//     the three surfaces every source app emits (PAIRS in each spoke's src/lib/upsell/telemetry.ts @ HH f3db5cabe
//     :31-33, HR 1f58e9da3 :74-76, HS 1b9ee6afa :75-77, NS afb8bd3fb :37-39, OHH dbad16a3a :75-77, MI-NEW e258e9c54
//     :74-76, PFP 511d19114 :69-71, TD 960ea5e62 :22-24) plus `converted` on upgrade-page, which Rello's trial-start
//     writes for any source (src/lib/upsell/seam-registry.ts UPGRADE_PAGE_SEAM; converted-signal.ts);
//     and Pathfinder Pro's 14 locked-feature surfaces with LOCK_EVENTS (PFP telemetry.ts:45 and :74 @ 511d19114;
//     slugs: @rello-platform/upgrade-content v0.14.1 src/pfp.ts:32-47, the tag PFP pins).
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

/** The three surfaces every one of the eight emits, and the events each one carries (converted: Rello writes it for upgrade-page). */
const COMMON_SURFACES: Record<string, readonly string[]> = {
  "menu-item": ["shown", "clicked"],
  "trial-banner": ["shown"],
  "upgrade-page": ["shown", "clicked", "converted"],
};

/** Pathfinder Pro's locked-feature surfaces (upgrade-content v0.14.1 pfp.ts:32-47) and the events PFP emits for each (LOCK_EVENTS). */
const PFP_LOCKED = [
  "call-workstation", "quick-quote", "hecm-advisor", "va-advisor", "dscr-advisor", "bank-statement-advisor", "pre-approval-letter",
  "events", "loan-programs", "exports", "check-your-rate", "refi-radar", "rate-widget", "email-signature",
] as const;
const LOCK_EVENTS = ["shown", "clicked", "preview-opened", "preview-explored", "blocked-hint", "dismissed"] as const;

const EIGHT = Object.keys(SEAMS) as AppSlug[];

/** Every surface an app registers, and the events of each: its seams (5 events), the three common surfaces, and for pathfinder-pro the 14 locked-feature surfaces. */
const surfacesOf = (app: string): Record<string, readonly string[]> => ({
  ...Object.fromEntries(SEAMS[app].map((seam) => [seam, EVENTS as readonly string[]])),
  ...COMMON_SURFACES,
  ...(app === PATHFINDER_PRO ? Object.fromEntries(PFP_LOCKED.map((slug) => [slug, LOCK_EVENTS as readonly string[]])) : {}),
});

/** The hub signal name for (app, seam, event): what a spoke writes to AuditLog today. */
const hubName = (app: string, seam: string, event: string) => `${app}.upsell.${seam}.${event}`;
/** Rello's converted-signal shape, copied from converted-signal.ts:45. */
const CONVERTED = /^[a-z0-9]+(?:-[a-z0-9]+)*\.upsell\.[a-z0-9]+(?:-[a-z0-9]+)*\.converted$/;

const keysOf = (surfaces: Record<string, readonly string[]>) => Object.entries(surfaces).flatMap(([surface, events]) => events.map((event) => `upsell.${surface}.${event}`));
const seamKeys = (app: string) => SEAMS[app].flatMap((seam) => EVENTS.map((event) => `upsell.${seam}.${event}`));
const commonKeys = keysOf(COMMON_SURFACES);
const lockKeys = PFP_LOCKED.flatMap((slug) => LOCK_EVENTS.map((event) => `upsell.${slug}.${event}`));
/** Every key an app registers, in registry order: seams, then the common surfaces, then pathfinder-pro's locked-feature surfaces. */
const expectedKeys = (app: string) => [...seamKeys(app), ...commonKeys, ...(app === PATHFINDER_PRO ? lockKeys : [])];
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

  test("each app registers exactly its seams × 5 events, the three common surfaces and (pathfinder-pro) the 14 locked-feature surfaces, in that order", () => {
    for (const app of EIGHT) expect(upsellOf(app), app).toEqual(expectedKeys(app));
  });

  test("the counts: 21 keys per app (pathfinder-pro 110), 257 in all; 125 of them are seam keys, 48 common-surface keys, 84 locked-feature keys", () => {
    expect(commonKeys).toHaveLength(6);
    expect(lockKeys).toHaveLength(84);
    for (const app of EIGHT) expect(upsellOf(app).length, app).toBe(app === PATHFINDER_PRO ? 110 : 21);
    expect(EIGHT.reduce((n, a) => n + upsellOf(a).length, 0)).toBe(257);
    expect(EIGHT.reduce((n, a) => n + seamKeys(a).length, 0)).toBe(125);
    expect(EIGHT.length * commonKeys.length).toBe(48);
  });

  test("every app registers the six common-surface keys, and only pathfinder-pro registers locked-feature keys", () => {
    for (const app of EIGHT) {
      for (const k of commonKeys) expect(FEATURES[app], `${app} ${k}`).toContain(k);
      for (const k of lockKeys) (app === PATHFINDER_PRO ? expect(FEATURES[app], `${app} ${k}`).toContain(k) : expect(FEATURES[app], `${app} ${k}`).not.toContain(k));
    }
  });

  test("the locked-feature table is 14 distinct slugs, none of them a seam or a common surface", () => {
    expect(PFP_LOCKED).toHaveLength(14);
    expect(new Set(PFP_LOCKED).size).toBe(14);
    const taken = new Set<string>([...Object.keys(COMMON_SURFACES), ...EIGHT.flatMap((a) => SEAMS[a])]);
    for (const slug of PFP_LOCKED) expect(taken.has(slug), slug).toBe(false);
  });

  test("every seam gets all five events, converted included", () => {
    for (const app of EIGHT) for (const seam of SEAMS[app]) for (const event of EVENTS) expect(FEATURES[app], `${app} ${seam} ${event}`).toContain(`upsell.${seam}.${event}`);
  });

  test("Growth's interest read finds its rows: every <surface>.clicked and upgrade-page.shown the apps emit is registered", () => {
    for (const app of EIGHT) {
      for (const surface of Object.keys(surfacesOf(app))) {
        if ((surfacesOf(app)[surface] as readonly string[]).includes("clicked")) expect(FEATURES[app], `${app} ${surface}.clicked`).toContain(`upsell.${surface}.clicked`);
      }
      expect(FEATURES[app], app).toContain("upsell.upgrade-page.shown");
    }
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

  test("a pair outside the table is still refused: an unlisted event on a listed surface, a locked-feature surface on a non-PFP app, an unknown surface", () => {
    for (const app of EIGHT) {
      const refused = [
        "upsell.menu-item.dismissed", "upsell.menu-item.converted", "upsell.trial-banner.clicked", "upsell.trial-banner.converted",
        "upsell.upgrade-page.dismissed", "upsell.upgrade-page.engaged", `upsell.${SEAMS[app][0]}.opened`,
        "upsell.quick-quote.converted", "upsell.quick-quote.engaged", "upsell.not-a-surface.shown", "upsell.shown", "upsell",
        ...(app === PATHFINDER_PRO ? [] : ["upsell.quick-quote.shown", "upsell.events.clicked"]),
      ];
      for (const k of refused) {
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

  test("refused for every other app unless that app lists the same key: seam and locked-feature keys are one app's, the six common-surface keys are all eight's", () => {
    for (const app of EIGHT) {
      for (const k of expectedKeys(app)) {
        for (const other of APP_SLUGS) {
          if (other === app) continue;
          const lists = (EIGHT as readonly string[]).includes(other) && expectedKeys(other).includes(k);
          expect(featureOk(other, k), `${k} sent as ${other}`).toBe(lists);
        }
      }
    }
  });

  test("the keys that are not shared are refused for every other app: all 125 seam keys and all 84 locked-feature keys", () => {
    for (const app of EIGHT) {
      for (const k of [...seamKeys(app), ...(app === PATHFINDER_PRO ? lockKeys : [])]) {
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
  test("forward: the hub name minus '<app>.' is a registered key, for every app, surface and event", () => {
    for (const app of EIGHT) for (const [surface, events] of Object.entries(surfacesOf(app))) for (const event of events) {
      const hub = hubName(app, surface, event);
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
        const m = /^upsell\.([a-z0-9]+(?:-[a-z0-9]+)*)\.([a-z]+(?:-[a-z]+)*)$/.exec(key);
        expect(m, hub).not.toBeNull();
        expect(Object.keys(surfacesOf(app)), hub).toContain(m![1]);
        expect(surfacesOf(app)[m![1]], hub).toContain(m![2]);
        expect(hubName(app, m![1], m![2]), hub).toBe(hub);
      }
    }
  });

  test("every converted key becomes the name Rello's trial-start writes, for each seam and for upgrade-page", () => {
    for (const app of EIGHT) for (const seam of [...SEAMS[app], "upgrade-page"]) {
      expect(CONVERTED.test(`${app}.upsell.${seam}.converted`), `${app} ${seam}`).toBe(true);
      expect(FEATURES[app], `${app} ${seam}`).toContain(`upsell.${seam}.converted`);
    }
  });

  test("the only converted keys are Rello's: one per seam and upgrade-page, none on a spoke-only surface", () => {
    for (const app of EIGHT) {
      const converted = upsellOf(app).filter((k) => k.endsWith(".converted"));
      expect([...converted].sort(), app).toEqual([...SEAMS[app], "upgrade-page"].map((s) => `upsell.${s}.converted`).sort());
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

  test("the longest upsell key is 58 characters, under the 80 cap", () => {
    const all = EIGHT.flatMap((a) => upsellOf(a));
    expect(all).toHaveLength(257);
    expect(Math.max(...all.map((k) => k.length))).toBe(58);
    expect(58).toBeLessThanOrEqual(FEATURE_KEY_MAX);
  });
});

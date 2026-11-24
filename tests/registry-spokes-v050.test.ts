// U3 (Platform KA 1874; plan marker U2-RULED-KA1858): FEATURES and ROUTES for the ten spoke apps.
//
// The EXPECTED table below is written out by hand from the ruled U2 list, not read from src/registry.ts,
// so it pins the rulings: server-rendered screens only; Drumbeat's 10-route trim; no /guest-mlo/* on
// home-ready; intakes.create (no save-lead keys) on pathfinder-pro; both byol.upload and byol.commit on
// harvest-home. Each app is keyed by its canonical slug from @rello-platform/slugs, by index with
// `satisfies` (the registry's own pattern), never by a literal slug list.
import { describe, expect, test } from "vitest";
import { APP_SLUGS, type AppSlug } from "@rello-platform/slugs";
import { EVENT_SCHEMAS, FEATURES, FEATURE_KEY_GRAMMAR, FEATURE_KEY_MAX, ROUTES, ROUTE_TEMPLATE_GRAMMAR, matchRoute } from "../src/index";
import { matchTemplate } from "../src/script/core";
import { RELLO } from "./fixtures";

const PATHFINDER_PRO = APP_SLUGS[11] satisfies "pathfinder-pro";
const HARVEST_HOME = APP_SLUGS[2] satisfies "harvest-home";
const HOME_READY = APP_SLUGS[3] satisfies "home-ready";
const HOME_SCOUT = APP_SLUGS[5] satisfies "home-scout";
const OPEN_HOUSE_HUB = APP_SLUGS[10] satisfies "open-house-hub";
const NEWSLETTER_STUDIO = APP_SLUGS[7] satisfies "newsletter-studio";
const MARKET_INTEL = APP_SLUGS[6] satisfies "market-intel";
const HOME_STRETCH = APP_SLUGS[4] satisfies "home-stretch";
const THE_DRUMBEAT = APP_SLUGS[9] satisfies "the-drumbeat";
const THE_OVEN = APP_SLUGS[8] satisfies "the-oven";

type Entry = { features: readonly string[]; routes: readonly string[] };

const EXPECTED: Record<string, Entry> = {
  [PATHFINDER_PRO]: {
    features: ["intakes.create", "scenarios.create", "scenarios.deliver", "pipeline.stage-change", "pipeline.note-create", "pre-approval.send", "rate-sheets.upload", "events.create", "intakes.export", "lenders.create", "refi-radar.upload"],
    routes: ["/dashboard/scenarios", "/dashboard/pipeline", "/dashboard/rates", "/dashboard/events", "/dashboard/events/[eventId]", "/dashboard/exports", "/dashboard/exports/[id]", "/dashboard/loan-programs", "/dashboard/loan-programs/[slug]", "/dashboard/dscr-advisor", "/dashboard/hecm-advisor", "/dashboard/bankstatement-advisor"],
  },
  [HARVEST_HOME]: {
    features: ["byol.upload", "byol.commit", "byol.action-run", "leads.manual-create", "call-list.mark-contacted", "call-list.snooze", "call-list.send-to-nurture", "pipeline.session-start", "discovery.unlock", "discovery.saved-search-create", "property-watch.create", "crm.connect"],
    routes: ["/onboarding/welcome", "/upgrade"],
  },
  [HOME_READY]: {
    features: ["leads.create", "leads.invite-send", "prospects.invite", "leads.note-create", "leads.document-upload", "leads.share", "leads.export-arive", "leads.mlo-assign", "journeys.enroll", "journeys.create", "agents.invite", "messages.send"],
    routes: ["/dashboard", "/dashboard/leads", "/dashboard/leads/add", "/dashboard/leads/[id]", "/dashboard/journeys", "/dashboard/journeys/builder", "/dashboard/journeys/builder/[templateId]", "/dashboard/mlo", "/dashboard/mlo/agents", "/dashboard/mlo/agents/[id]", "/dashboard/mlo/analytics", "/dashboard/mlo/leaderboard", "/dashboard/mlo/source-analytics", "/dashboard/notifications", "/dashboard/qr-code", "/dashboard/invite", "/dashboard/settings"],
  },
  [HOME_SCOUT]: {
    features: ["widgets.create", "landing-pages.create", "landing-pages.publish", "ctas.create", "forms.create", "testimonials.create", "identity.update", "settings.update", "guest-mlo.link", "privacy-requests.answer"],
    routes: ["/dashboard", "/analytics", "/branding", "/ctas", "/embeds", "/forms", "/identity", "/landing-pages", "/landing-pages/new", "/landing-pages/[id]/edit", "/privacy-requests", "/tenant-settings", "/tools"],
  },
  [OPEN_HOUSE_HUB]: {
    features: ["events.create", "attendees.add", "events.cohost-invite", "showings.create", "showings.confirm", "showings.complete", "tours.create", "tours.itinerary-send", "seller-listings.create", "follow-ups.send"],
    routes: ["/dashboard/co-hosting", "/dashboard/upgrade"],
  },
  [NEWSLETTER_STUDIO]: {
    features: ["newsletters.create", "newsletters.send", "newsletters.schedule", "newsletters.test-send", "templates.create", "flows.create", "flows.enroll-lead", "leads.create", "leads.import", "listings.create", "sources.feed-add", "writing-styles.create"],
    routes: ["/dashboard/settings/sources", "/dashboard/settings/writing-style", "/dashboard/upgrade"],
  },
  [MARKET_INTEL]: {
    features: ["digests.generate", "digests.send", "breaking-news.send", "subscribers.invite", "subscribers.access-approve", "sources.create", "websites.create", "announcements.create", "podcast.settings-update", "branding.update"],
    routes: ["/admin", "/admin/digests", "/admin/queue", "/admin/subscribers", "/admin/sources", "/admin/websites", "/admin/podcast", "/admin/announcements", "/admin/branding"],
  },
  [HOME_STRETCH]: {
    features: ["leads.create", "leads.update", "leads.activity-create", "leads.score-recalculate", "leads.document-upload", "leads.tag-update", "invitations.create", "agents.invite-resend", "mlo-partners.create", "milo.chat", "milo.lead-analysis"],
    routes: ["/dashboard/agent", "/dashboard/invite", "/dashboard/settings", "/dashboard/settings/apps", "/dashboard/settings/articles", "/dashboard/settings/team"],
  },
  [THE_DRUMBEAT]: {
    features: ["campaigns.create", "social.post-create", "social.post-publish", "content.draft-approve", "blog.post-publish", "video.upload", "direct-mail.send", "listings.campaign-dispatch", "audiences.create", "qr-codes.create", "bio-links.create", "utm-links.create"],
    routes: ["/dashboard", "/campaigns", "/campaigns/[id]", "/content/social", "/content/blog", "/content/video", "/listings", "/outreach/audiences", "/outreach/direct-mail", "/pages/qr-codes"],
  },
  [THE_OVEN]: {
    features: ["referrals.create", "programs.create", "reviews.request", "reviews.response-post", "reviews.testimonial-approve", "reviews.connect", "hub.invite-send", "revival.start", "transition.hand-off", "service-providers.create", "check-ins.configure", "past-clients.create"],
    routes: ["/dashboard", "/alerts", "/check-ins", "/homeowner-hub", "/past-clients", "/past-clients/[relloLeadId]", "/referrals", "/referrals/new", "/referrals/[id]", "/reviews", "/reviews/analytics", "/reviews/connect/yelp", "/reviews/inbox", "/reviews/request", "/reviews/testimonials", "/reviving", "/reviving/campaign", "/reviving/[id]", "/service-providers", "/settings", "/transition", "/transition/[leadId]"],
  },
};

const COUNTS: Record<string, readonly [number, number]> = {
  [PATHFINDER_PRO]: [11, 12],
  [HARVEST_HOME]: [12, 2],
  [HOME_READY]: [12, 17],
  [HOME_SCOUT]: [10, 13],
  [OPEN_HOUSE_HUB]: [10, 2],
  [NEWSLETTER_STUDIO]: [12, 3],
  [MARKET_INTEL]: [10, 9],
  [HOME_STRETCH]: [11, 6],
  [THE_DRUMBEAT]: [12, 10],
  [THE_OVEN]: [12, 22],
};

const TEN = Object.keys(EXPECTED) as AppSlug[];

// Every loop below walks the RULED lists (EXPECTED), so a registry that is empty or short cannot pass by
// having nothing to check. `registered` is the guard for the loops that must walk the registry itself.
const featuresOf = (app: AppSlug) => EXPECTED[app].features;
const routesOf = (app: AppSlug) => EXPECTED[app].routes;
const registered = (app: AppSlug) => {
  expect(ROUTES[app].length, `${app} routes registered`).toBe(routesOf(app).length);
  expect(FEATURES[app].length, `${app} features registered`).toBe(featuresOf(app).length);
  return { routes: ROUTES[app], features: FEATURES[app] };
};

// A whole server event, as the helper builds it.
const server = (over: Record<string, unknown>) => ({
  id: "3f0e8a52-6d1b-4c1e-9a77-2b9d6c0f4e11",
  ts: "2026-11-24T17:00:00.000Z",
  tenantId: "tenant-1",
  surface: "in_app",
  ...over,
});
const featureOk = (app: string, feature: string) => EVENT_SCHEMAS["feature.used"].safeParse(server({ name: "feature.used", app, feature, count: 1 })).success;
const screenOk = (app: string, route: string) => EVENT_SCHEMAS["screen.opened"].safeParse(server({ name: "screen.opened", app, route })).success;

/** A concrete path for a template: each [param] becomes a value shaped like an id. */
const sample = (t: string, v = "clx9q2w3e0000abcd1234efgh") => t.replace(/\[[a-zA-Z]+\]/g, v);

describe("the ten spoke apps are all keyed, and by canonical slug", () => {
  test("the ten are ten distinct canonical app slugs, none of them rello", () => {
    expect(TEN).toHaveLength(10);
    expect(new Set(TEN).size).toBe(10);
    for (const app of TEN) {
      expect(APP_SLUGS as readonly string[], app).toContain(app);
      expect(app).not.toBe(RELLO);
    }
  });

  test("each of the ten registers exactly its ruled FEATURES and ROUTES, in order", () => {
    for (const app of TEN) {
      expect([...FEATURES[app]], `${app} features`).toEqual([...EXPECTED[app].features]);
      expect([...ROUTES[app]], `${app} routes`).toEqual([...EXPECTED[app].routes]);
    }
  });

  test("the counts are the ruled counts: 112 feature keys, 96 route templates", () => {
    for (const app of TEN) {
      expect([FEATURES[app].length, ROUTES[app].length], app).toEqual([...COUNTS[app]]);
    }
    expect(TEN.reduce((n, a) => n + FEATURES[a].length, 0)).toBe(112);
    expect(TEN.reduce((n, a) => n + ROUTES[a].length, 0)).toBe(96);
  });

  test("no app outside the ten and rello registers anything (arive, prequal-pro)", () => {
    for (const app of APP_SLUGS) {
      if (app === RELLO || (TEN as readonly string[]).includes(app)) continue;
      expect(FEATURES[app], app).toEqual([]);
      expect(ROUTES[app], app).toEqual([]);
    }
  });
});

describe("the rulings (U2-RULED-KA1858)", () => {
  test("Drumbeat takes its 10-route trim, not 37", () => {
    expect(ROUTES[THE_DRUMBEAT]).toHaveLength(10);
  });
  test("home-ready has no /guest-mlo/* route (an invited outside loan officer is not the paying customer)", () => {
    expect(registered(HOME_READY).routes.filter((t) => t.startsWith("/guest-mlo"))).toEqual([]);
    expect(matchRoute("/guest-mlo/dashboard", ROUTES[HOME_READY])).toBeUndefined();
    expect(matchRoute("/guest-mlo/leads/abc", ROUTES[HOME_READY])).toBeUndefined();
  });
  test("pathfinder-pro keeps intakes.create and adds no save-lead key", () => {
    expect(FEATURES[PATHFINDER_PRO]).toContain("intakes.create");
    expect(registered(PATHFINDER_PRO).features.filter((k) => k.includes("save-lead"))).toEqual([]);
    expect(FEATURES[PATHFINDER_PRO]).not.toContain("leads.create");
  });
  test("harvest-home registers both byol.upload and byol.commit", () => {
    expect(FEATURES[HARVEST_HOME]).toContain("byol.upload");
    expect(FEATURES[HARVEST_HOME]).toContain("byol.commit");
  });
  test("no registered route is a client-portal, borrower or homeowner path (plan §3.3 item 4, ruling 6)", () => {
    for (const app of TEN) for (const t of registered(app).routes) expect(t, `${app} ${t}`).not.toMatch(/^\/(portal|api|guest-mlo|c|d)(\/|$)/);
  });
});

describe("every listed feature key: accepted for its app, refused for every app that does not list it", () => {
  test("accepted as feature.used for its own app", () => {
    for (const app of TEN) for (const f of featuresOf(app)) expect(featureOk(app, f), `${app} ${f}`).toBe(true);
  });
  test("refused for every other app that does not itself list the key", () => {
    for (const app of TEN) {
      for (const f of featuresOf(app)) {
        for (const other of APP_SLUGS) {
          if (other === app || FEATURES[other].includes(f)) continue;
          expect(featureOk(other, f), `${f} sent as ${other}`).toBe(false);
        }
      }
    }
  });
  test("an unregistered key and a free-text value are still refused for each of the ten", () => {
    for (const app of TEN) {
      expect(featureOk(app, "leads.delete"), app).toBe(false);
      expect(featureOk(app, "jane@example.com"), app).toBe(false);
    }
  });
  test("each key fits FEATURE_KEY_GRAMMAR and FEATURE_KEY_MAX, and none repeats within an app", () => {
    for (const app of TEN) {
      const { features } = registered(app);
      for (const f of features) {
        expect(f, `${app} ${f}`).toMatch(FEATURE_KEY_GRAMMAR);
        expect(f.length, `${app} ${f}`).toBeLessThanOrEqual(FEATURE_KEY_MAX);
      }
      expect(new Set(features).size, `${app} features`).toBe(features.length);
    }
  });
});

describe("every listed route template: accepted for its app, refused for every app that does not list it", () => {
  test("accepted as screen.opened for its own app", () => {
    for (const app of TEN) for (const t of routesOf(app)) expect(screenOk(app, t), `${app} ${t}`).toBe(true);
  });
  test("refused for every other app that does not itself list the template", () => {
    for (const app of TEN) {
      for (const t of routesOf(app)) {
        for (const other of APP_SLUGS) {
          if (other === app || ROUTES[other].includes(t)) continue;
          expect(screenOk(other, t), `${t} sent as ${other}`).toBe(false);
        }
      }
    }
  });
  test("a concrete path is never a registered value, for any of the ten", () => {
    for (const app of TEN) for (const t of routesOf(app).filter((x) => x.includes("["))) {
      expect(screenOk(app, sample(t)), `${app} ${sample(t)}`).toBe(false);
    }
  });
  test("each template fits ROUTE_TEMPLATE_GRAMMAR and none repeats within an app", () => {
    for (const app of TEN) {
      const { routes } = registered(app);
      for (const t of routes) expect(t, `${app} ${t}`).toMatch(ROUTE_TEMPLATE_GRAMMAR);
      expect(new Set(routes).size, `${app} routes`).toBe(routes.length);
    }
  });
});

describe("matching: a sample path of each template's shape maps to that template, in both matchers", () => {
  test("every template matches a sample path of its shape (and a different id-shaped value does too)", () => {
    for (const app of TEN) {
      for (const t of routesOf(app)) {
        for (const v of ["clx9q2w3e0000abcd1234efgh", "123456", "jane-doe"]) {
          const path = sample(t, v);
          expect(matchRoute(path, ROUTES[app]), `${app} ${path}`).toBe(t);
          expect(matchTemplate(path, ROUTES[app]), `${app} ${path}`).toBe(t);
        }
      }
    }
  });

  test("static-before-[param]: any static template a [param] template of the same shape would swallow is listed first", () => {
    for (const app of TEN) {
      const list = registered(app).routes;
      list.forEach((p, pi) => {
        if (!p.includes("[")) return;
        list.forEach((s, si) => {
          if (s.includes("[") || matchRoute(s, [p]) === undefined) return;
          expect(si, `${app}: ${s} must come before ${p}`).toBeLessThan(pi);
        });
      });
    }
  });

  test("every static template matches itself (first match wins, nothing is shadowed)", () => {
    for (const app of TEN) {
      for (const t of routesOf(app).filter((x) => !x.includes("["))) {
        expect(matchRoute(t, ROUTES[app]), `${app} ${t}`).toBe(t);
        expect(matchTemplate(t, ROUTES[app]), `${app} ${t}`).toBe(t);
      }
    }
  });

  test("the ruled static twins exist and sit ahead of their [param] sibling", () => {
    const before = (app: AppSlug, s: string, p: string) => {
      expect(ROUTES[app].indexOf(s), `${app} ${s}`).toBeGreaterThanOrEqual(0);
      expect(ROUTES[app].indexOf(s), `${app} ${s} < ${p}`).toBeLessThan(ROUTES[app].indexOf(p));
    };
    before(HOME_READY, "/dashboard/leads/add", "/dashboard/leads/[id]");
    before(THE_OVEN, "/referrals/new", "/referrals/[id]");
    before(THE_OVEN, "/reviving/campaign", "/reviving/[id]");
  });

  test("no path with an extra or missing segment matches a one-param template", () => {
    expect(matchRoute("/dashboard/leads/a/b", ROUTES[HOME_READY])).toBeUndefined();
    expect(matchRoute("/campaigns/", ROUTES[THE_DRUMBEAT])).toBe(undefined);
    expect(matchRoute("/transition/", ROUTES[THE_OVEN])).toBeUndefined();
  });
});

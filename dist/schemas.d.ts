/**
 * The 12 events (plan §3.1). Every schema is `.strict()`: no event has a free-form
 * property bag, and an extra key is refused (§3.3 item 1). Every string is bounded
 * (§3.3 item 5; enforced by `findUnboundedStrings` in ./guards and its test).
 *
 * These are the STORED events: the common fields are filled in by the edge or the app
 * server and are never trusted from a browser (§3.1). The page script sends only the
 * event name and its own fields; the edge adds the rest and validates the result here.
 *
 * The event name is carried in `name`.
 */
import { z } from "zod";
import { type AppSlug } from "@rello-platform/slugs";
export declare const EVENT_NAMES: readonly ["link.hit", "link.scanned", "visit.start", "page.view", "page.leave", "scroll.depth", "section.read", "cta.click", "widget.use", "identify", "screen.opened", "feature.used"];
export type EventName = (typeof EVENT_NAMES)[number];
export declare const SURFACES: readonly ["marketing", "tenant_site", "spoke_public", "in_app"];
export declare const DEVICE_CLASSES: readonly ["mobile", "tablet", "desktop", "bot"];
export declare const UA_CLASSES: readonly ["browser", "scanner", "prefetch", "bot", "unknown"];
export declare const ASN_CLASSES: readonly ["residential", "mobile", "business", "hosting", "security_vendor", "unknown"];
/** The site page-type enum for `page.view.pageType` (read from `<meta name="rello:page-type">`, §10). */
export declare const PAGE_TYPES: readonly ["home", "feature", "pricing", "compare", "integrations", "about", "blog", "article", "contact", "legal", "signup", "listing", "portal", "app", "other"];
export declare const SCROLL_DEPTHS: readonly [25, 50, 75, 100];
export declare const WIDGET_ACTIONS: readonly ["open", "change", "submit"];
export declare const IDENTIFY_SOURCES: readonly ["email_token", "sign_in", "form", "checkout"];
/** S12 design §8 Rev 3 reach block: whether a page view is the document load or an in-page route change. */
export declare const PAGE_NAVS: readonly ["load", "spa"];
/**
 * v0.2.0 (S9): the events only an app SERVER sends. The browser intake refuses both by name
 * (tracking-engine src/intake.ts BROWSER_EVENTS), so they reach the store only through the
 * keyed server intake.
 */
export declare const SERVER_EVENT_NAMES: readonly ["feature.used", "screen.opened"];
export type ServerEventName = (typeof SERVER_EVENT_NAMES)[number];
type Registry = {
    readonly [A in AppSlug]: readonly string[];
};
/**
 * Build the 12 schemas against a pair of registries. The package exports them built
 * against `FEATURES` and `ROUTES` (`EVENT_SCHEMAS`); tests can build them against a
 * fixture registry to exercise an accepted `feature.used`.
 */
export declare function buildEventSchemas(reg: {
    features: Registry;
    routes: Registry;
}): {
    readonly "link.hit": z.ZodObject<{
        rg: z.ZodOptional<z.ZodString>;
        r: z.ZodOptional<z.ZodString>;
        uaClass: z.ZodEnum<{
            unknown: "unknown";
            bot: "bot";
            browser: "browser";
            scanner: "scanner";
            prefetch: "prefetch";
        }>;
        asnClass: z.ZodEnum<{
            unknown: "unknown";
            mobile: "mobile";
            residential: "residential";
            business: "business";
            hosting: "hosting";
            security_vendor: "security_vendor";
        }>;
        adClick: z.ZodOptional<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                gclid: "gclid";
                gbraid: "gbraid";
                wbraid: "wbraid";
                fbclid: "fbclid";
            }>;
            id: z.ZodString;
        }, z.core.$strict>>>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"link.hit">;
    }, z.core.$strict>;
    readonly "link.scanned": z.ZodObject<{
        rg: z.ZodOptional<z.ZodString>;
        r: z.ZodOptional<z.ZodString>;
        uaClass: z.ZodEnum<{
            unknown: "unknown";
            bot: "bot";
            browser: "browser";
            scanner: "scanner";
            prefetch: "prefetch";
        }>;
        asnClass: z.ZodEnum<{
            unknown: "unknown";
            mobile: "mobile";
            residential: "residential";
            business: "business";
            hosting: "hosting";
            security_vendor: "security_vendor";
        }>;
        adClick: z.ZodOptional<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                gclid: "gclid";
                gbraid: "gbraid";
                wbraid: "wbraid";
                fbclid: "fbclid";
            }>;
            id: z.ZodString;
        }, z.core.$strict>>>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"link.scanned">;
    }, z.core.$strict>;
    readonly "visit.start": z.ZodObject<{
        landingPath: z.ZodString;
        referrerHost: z.ZodOptional<z.ZodString>;
        utm: z.ZodOptional<z.ZodObject<{
            source: z.ZodOptional<z.ZodString>;
            medium: z.ZodOptional<z.ZodString>;
            campaign: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        rg: z.ZodOptional<z.ZodString>;
        adClick: z.ZodOptional<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                gclid: "gclid";
                gbraid: "gbraid";
                wbraid: "wbraid";
                fbclid: "fbclid";
            }>;
            id: z.ZodString;
        }, z.core.$strict>>>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"visit.start">;
    }, z.core.$strict>;
    readonly "page.view": z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        pageType: z.ZodEnum<{
            home: "home";
            feature: "feature";
            pricing: "pricing";
            compare: "compare";
            integrations: "integrations";
            about: "about";
            blog: "blog";
            article: "article";
            contact: "contact";
            legal: "legal";
            signup: "signup";
            listing: "listing";
            portal: "portal";
            app: "app";
            other: "other";
        }>;
        title: z.ZodOptional<z.ZodString>;
        pageId: z.ZodOptional<z.ZodString>;
        nav: z.ZodOptional<z.ZodEnum<{
            load: "load";
            spa: "spa";
        }>>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"page.view">;
    }, z.core.$strict>;
    readonly "page.leave": z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"page.leave">;
        activeMs: z.ZodNumber;
    }, z.core.$strict>;
    readonly "scroll.depth": z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"scroll.depth">;
        depth: z.ZodUnion<[z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<75>, z.ZodLiteral<100>]>;
    }, z.core.$strict>;
    readonly "section.read": z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"section.read">;
        sectionId: z.ZodString;
        topic: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    readonly "cta.click": z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"cta.click">;
        ctaId: z.ZodString;
        destHost: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    readonly "widget.use": z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"widget.use">;
        widgetId: z.ZodString;
        action: z.ZodEnum<{
            open: "open";
            change: "change";
            submit: "submit";
        }>;
    }, z.core.$strict>;
    readonly identify: z.ZodObject<{
        person: z.ZodString;
        source: z.ZodEnum<{
            email_token: "email_token";
            sign_in: "sign_in";
            form: "form";
            checkout: "checkout";
        }>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"identify">;
    }, z.core.$strict>;
    readonly "screen.opened": z.ZodObject<{
        route: z.ZodString;
        visitorId: z.ZodOptional<z.ZodString>;
        sessionId: z.ZodOptional<z.ZodString>;
        country: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        deviceClass: z.ZodOptional<z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>>;
        ipHash: z.ZodOptional<z.ZodString>;
        gpc: z.ZodOptional<z.ZodBoolean>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        clickId: z.ZodOptional<z.ZodString>;
        name: z.ZodLiteral<"screen.opened">;
    }, z.core.$strict>;
    readonly "feature.used": z.ZodObject<{
        feature: z.ZodString;
        count: z.ZodNumber;
        visitorId: z.ZodOptional<z.ZodString>;
        sessionId: z.ZodOptional<z.ZodString>;
        country: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        deviceClass: z.ZodOptional<z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>>;
        ipHash: z.ZodOptional<z.ZodString>;
        gpc: z.ZodOptional<z.ZodBoolean>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        clickId: z.ZodOptional<z.ZodString>;
        name: z.ZodLiteral<"feature.used">;
    }, z.core.$strict>;
};
export declare const EVENT_SCHEMAS: {
    readonly "link.hit": z.ZodObject<{
        rg: z.ZodOptional<z.ZodString>;
        r: z.ZodOptional<z.ZodString>;
        uaClass: z.ZodEnum<{
            unknown: "unknown";
            bot: "bot";
            browser: "browser";
            scanner: "scanner";
            prefetch: "prefetch";
        }>;
        asnClass: z.ZodEnum<{
            unknown: "unknown";
            mobile: "mobile";
            residential: "residential";
            business: "business";
            hosting: "hosting";
            security_vendor: "security_vendor";
        }>;
        adClick: z.ZodOptional<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                gclid: "gclid";
                gbraid: "gbraid";
                wbraid: "wbraid";
                fbclid: "fbclid";
            }>;
            id: z.ZodString;
        }, z.core.$strict>>>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"link.hit">;
    }, z.core.$strict>;
    readonly "link.scanned": z.ZodObject<{
        rg: z.ZodOptional<z.ZodString>;
        r: z.ZodOptional<z.ZodString>;
        uaClass: z.ZodEnum<{
            unknown: "unknown";
            bot: "bot";
            browser: "browser";
            scanner: "scanner";
            prefetch: "prefetch";
        }>;
        asnClass: z.ZodEnum<{
            unknown: "unknown";
            mobile: "mobile";
            residential: "residential";
            business: "business";
            hosting: "hosting";
            security_vendor: "security_vendor";
        }>;
        adClick: z.ZodOptional<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                gclid: "gclid";
                gbraid: "gbraid";
                wbraid: "wbraid";
                fbclid: "fbclid";
            }>;
            id: z.ZodString;
        }, z.core.$strict>>>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"link.scanned">;
    }, z.core.$strict>;
    readonly "visit.start": z.ZodObject<{
        landingPath: z.ZodString;
        referrerHost: z.ZodOptional<z.ZodString>;
        utm: z.ZodOptional<z.ZodObject<{
            source: z.ZodOptional<z.ZodString>;
            medium: z.ZodOptional<z.ZodString>;
            campaign: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        rg: z.ZodOptional<z.ZodString>;
        adClick: z.ZodOptional<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                gclid: "gclid";
                gbraid: "gbraid";
                wbraid: "wbraid";
                fbclid: "fbclid";
            }>;
            id: z.ZodString;
        }, z.core.$strict>>>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"visit.start">;
    }, z.core.$strict>;
    readonly "page.view": z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        pageType: z.ZodEnum<{
            home: "home";
            feature: "feature";
            pricing: "pricing";
            compare: "compare";
            integrations: "integrations";
            about: "about";
            blog: "blog";
            article: "article";
            contact: "contact";
            legal: "legal";
            signup: "signup";
            listing: "listing";
            portal: "portal";
            app: "app";
            other: "other";
        }>;
        title: z.ZodOptional<z.ZodString>;
        pageId: z.ZodOptional<z.ZodString>;
        nav: z.ZodOptional<z.ZodEnum<{
            load: "load";
            spa: "spa";
        }>>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"page.view">;
    }, z.core.$strict>;
    readonly "page.leave": z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"page.leave">;
        activeMs: z.ZodNumber;
    }, z.core.$strict>;
    readonly "scroll.depth": z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"scroll.depth">;
        depth: z.ZodUnion<[z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<75>, z.ZodLiteral<100>]>;
    }, z.core.$strict>;
    readonly "section.read": z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"section.read">;
        sectionId: z.ZodString;
        topic: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    readonly "cta.click": z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"cta.click">;
        ctaId: z.ZodString;
        destHost: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    readonly "widget.use": z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"widget.use">;
        widgetId: z.ZodString;
        action: z.ZodEnum<{
            open: "open";
            change: "change";
            submit: "submit";
        }>;
    }, z.core.$strict>;
    readonly identify: z.ZodObject<{
        person: z.ZodString;
        source: z.ZodEnum<{
            email_token: "email_token";
            sign_in: "sign_in";
            form: "form";
            checkout: "checkout";
        }>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        visitorId: z.ZodString;
        sessionId: z.ZodString;
        clickId: z.ZodOptional<z.ZodString>;
        country: z.ZodString;
        region: z.ZodString;
        deviceClass: z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>;
        ipHash: z.ZodString;
        gpc: z.ZodBoolean;
        name: z.ZodLiteral<"identify">;
    }, z.core.$strict>;
    readonly "screen.opened": z.ZodObject<{
        route: z.ZodString;
        visitorId: z.ZodOptional<z.ZodString>;
        sessionId: z.ZodOptional<z.ZodString>;
        country: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        deviceClass: z.ZodOptional<z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>>;
        ipHash: z.ZodOptional<z.ZodString>;
        gpc: z.ZodOptional<z.ZodBoolean>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        clickId: z.ZodOptional<z.ZodString>;
        name: z.ZodLiteral<"screen.opened">;
    }, z.core.$strict>;
    readonly "feature.used": z.ZodObject<{
        feature: z.ZodString;
        count: z.ZodNumber;
        visitorId: z.ZodOptional<z.ZodString>;
        sessionId: z.ZodOptional<z.ZodString>;
        country: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        deviceClass: z.ZodOptional<z.ZodEnum<{
            mobile: "mobile";
            tablet: "tablet";
            desktop: "desktop";
            bot: "bot";
        }>>;
        ipHash: z.ZodOptional<z.ZodString>;
        gpc: z.ZodOptional<z.ZodBoolean>;
        id: z.ZodUUID;
        ts: z.ZodISODateTime;
        tenantId: z.ZodString;
        app: z.ZodEnum<{
            arive: "arive";
            rello: "rello";
            "harvest-home": "harvest-home";
            "home-ready": "home-ready";
            "home-stretch": "home-stretch";
            "home-scout": "home-scout";
            "market-intel": "market-intel";
            "newsletter-studio": "newsletter-studio";
            "the-oven": "the-oven";
            "the-drumbeat": "the-drumbeat";
            "open-house-hub": "open-house-hub";
            "pathfinder-pro": "pathfinder-pro";
            "prequal-pro": "prequal-pro";
        }>;
        surface: z.ZodEnum<{
            marketing: "marketing";
            tenant_site: "tenant_site";
            spoke_public: "spoke_public";
            in_app: "in_app";
        }>;
        clickId: z.ZodOptional<z.ZodString>;
        name: z.ZodLiteral<"feature.used">;
    }, z.core.$strict>;
};
export type TrackingEvent = {
    [N in EventName]: z.infer<(typeof EVENT_SCHEMAS)[N]>;
}[EventName];
/** Validate one stored event by its `name`. Unknown names are refused. */
export declare function parseEvent(input: unknown): {
    ok: true;
    event: TrackingEvent;
} | {
    ok: false;
    error: string;
};
export {};
//# sourceMappingURL=schemas.d.ts.map
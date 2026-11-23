/**
 * Browser entry for the page script (plan §4). Built to `dist/script/s.js` as a
 * minified IIFE with no imports at runtime; served same-origin at `/t/s.v<maj>.<min>.js`
 * and included as `<script defer src="/t/s.v1.0.js" data-surface="marketing"></script>`.
 *
 * Attributes on the script tag:
 * - `data-surface`: marketing | tenant_site | spoke_public | in_app (default marketing).
 * - `data-routes`: on spoke_public / in_app, the app's registered route templates,
 *   space-separated. The path sent is the matched template, never the URL; with no
 *   match no path is sent (§3.2).
 *
 * On spoke_public the script sends only `page.view` (on load and on an in-page route
 * change): no scroll, section, click or pagehide listener is installed (§3.3 item 4).
 */
import { createTransport, matchTemplate, type ClientEvent } from "./core.js";

const PAGE_TYPES = "home feature pricing compare integrations about blog article contact legal signup listing portal app other".split(" ");
const SLUG = /^[a-z0-9-]{1,64}$/;
/** S12 design §5.1: the four ad-click keys and their value shape (the same as AD_CLICK_KEYS / AD_CLICK_VALUE in ../ads.ts; a test pins them equal). */
const AD_KEYS = "gclid gbraid wbraid fbclid".split(" ");
const AD_VALUE = /^[A-Za-z0-9._-]{8,512}$/;
/** A loader reason's shape; the edge checks it against ADS_REASONS. */
const REASON = /^[a-z_]{1,32}$/;

/** Every callback the script installs runs through this: tracking never throws into the page (GD-2739). */
const safe =
  <A extends unknown[]>(f: (...a: A) => void) =>
  (...a: A): void => {
    try {
      f(...a);
    } catch {
      /* the page never knows */
    }
  };

(() => {
  try {
    const w = window;
    const d = document;
    const tag = d.currentScript as HTMLScriptElement | null;
    const surface = tag?.dataset.surface || "marketing";
    const templated = surface === "spoke_public" || surface === "in_app";
    const routes = (tag?.dataset.routes || "").split(" ").filter(Boolean);
    const published = surface === "marketing" || surface === "tenant_site";
    // Plan §3.3 item 4 (GD-3035): pages a tenant's clients use send page.view and nothing else, so on
    // spoke_public none of the scroll / section / click / pagehide listeners below is installed.
    const full = surface !== "spoke_public";
    let st: Storage | undefined;
    try {
      st = w.localStorage;
    } catch {
      st = undefined;
    }
    const rnd = (): string => (w.crypto?.randomUUID ? w.crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
    // S12 design §8 Rev 3 reach block: one pageId per document load, never per SPA route change.
    const pageId = rnd();
    let nav = "load";
    const t = createTransport({
      now: () => Date.now(),
      setTimeout: (f, ms) => w.setTimeout(f, ms),
      clearTimeout: (id) => w.clearTimeout(id as number),
      fetch: w.fetch ? (u, i) => w.fetch(u, i) : undefined,
      sendBeacon: navigator.sendBeacon ? (u, b) => navigator.sendBeacon(u, b) : undefined,
      storage: st,
      random: rnd,
      gpc: (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
    });

    const pathNow = (): string | undefined => {
      const p = location.pathname.slice(0, 512);
      return templated ? matchTemplate(p, routes) : p;
    };
    const withPath = (e: ClientEvent): ClientEvent => {
      const p = pathNow();
      if (p !== undefined) e.path = p;
      return e;
    };

    let marks: Record<number, 1> = {};
    let visibleMs = 0;
    let visibleSince = d.visibilityState === "visible" ? Date.now() : 0;

    const view = safe((): void => {
      marks = {};
      const meta = d.querySelector<HTMLMetaElement>('meta[name="rello:page-type"]')?.content || "";
      const e: ClientEvent = { name: "page.view", pageType: PAGE_TYPES.includes(meta) ? meta : "other" };
      if (published) {
        if (d.title) e.title = d.title.slice(0, 120);
        e.pageId = pageId;
        e.nav = nav;
      }
      nav = "spa";
      t.push(withPath(e));
    });

    // scroll.depth at 25/50/75/100 crossings
    const onScroll = safe((): void => {
      const h = d.documentElement.scrollHeight;
      if (!h) return;
      const pct = ((w.scrollY + w.innerHeight) / h) * 100;
      for (const depth of [25, 50, 75, 100]) {
        if (pct >= depth && !marks[depth]) {
          marks[depth] = 1;
          t.push(withPath({ name: "scroll.depth", depth }));
        }
      }
    });

    // section.read: a [data-section] at least 50 % visible for at least 4 s, once per page
    const read: Record<string, 1> = {};
    const waits = new Map<Element, number>();
    if (full && "IntersectionObserver" in w) {
      const io = new IntersectionObserver(
        safe((entries: IntersectionObserverEntry[]) => {
          for (const en of entries) {
            const el = en?.target as HTMLElement | undefined;
            if (!el || !el.dataset) continue;
            const id = el.dataset.section || "";
            if (!SLUG.test(id) || read[id]) continue;
            if (en.intersectionRatio >= 0.5) {
              if (!waits.has(el)) {
                waits.set(
                  el,
                  w.setTimeout(
                    safe(() => {
                    read[id] = 1;
                    const e: ClientEvent = { name: "section.read", sectionId: id };
                    const topic = el.dataset.topic || "";
                    if (SLUG.test(topic)) e.topic = topic;
                    t.push(withPath(e));
                    }),
                    4000,
                  ),
                );
              }
            } else if (waits.has(el)) {
              w.clearTimeout(waits.get(el));
              waits.delete(el);
            }
          }
        }),
        { threshold: [0, 0.5] },
      );
      d.querySelectorAll("[data-section]").forEach((el) => io.observe(el));
    }

    // cta.click and widget.use: attributes only, never a value or text
    if (full) d.addEventListener(
      "click",
      safe((ev: Event) => {
        const el = ev.target instanceof Element ? ev.target : null;
        const cta = el?.closest<HTMLElement>("[data-cta]");
        if (cta && SLUG.test(cta.dataset.cta || "")) {
          const e: ClientEvent = { name: "cta.click", ctaId: cta.dataset.cta };
          const a = cta.closest("a");
          if (a && a.host && a.host !== location.host) e.destHost = a.hostname.toLowerCase();
          t.push(withPath(e));
        }
        const wd = el?.closest<HTMLElement>("[data-widget]");
        if (wd && SLUG.test(wd.dataset.widget || "")) {
          const act = wd.dataset.widgetAction || "";
          t.push(withPath({ name: "widget.use", widgetId: wd.dataset.widget, action: ["change", "submit"].includes(act) ? act : "open" }));
        }
      }),
      true,
    );

    const loader = safe(() => {
      const s = d.createElement("script");
      s.src = "/t/a.v1.js";
      d.head.appendChild(s);
    });
    const idle = safe(() => {
      if (w.requestIdleCallback) w.requestIdleCallback(loader);
      else w.setTimeout(loader, 1);
    });

    // In-app route changes count as views: every pushState, and a replaceState that changes the
    // path. The native call runs first and OUTSIDE any catch, so an error it throws reaches the
    // page's caller unchanged; only the tracking that follows is guarded (GD-2739).
    let lastPath = location.pathname;
    const onNav = safe((always: boolean) => {
      const p = location.pathname;
      if (always || p !== lastPath) view();
      lastPath = p;
    });
    const wrap = (k: "pushState" | "replaceState"): void => {
      const native = history[k];
      if (typeof native !== "function") return;
      history[k] = function (this: History, ...args: Parameters<History["pushState"]>) {
        const r = native.apply(this, args);
        onNav(k === "pushState");
        return r;
      };
    };
    wrap("pushState");
    wrap("replaceState");
    w.addEventListener("popstate", () => onNav(true));

    if (full) w.addEventListener("scroll", onScroll, { passive: true });
    d.addEventListener(
      "visibilitychange",
      safe(() => {
        if (d.visibilityState === "hidden") {
          if (visibleSince) visibleMs += Date.now() - visibleSince;
          visibleSince = 0;
          t.flush(true);
        } else visibleSince = Date.now();
      }),
    );
    if (full) w.addEventListener(
      "pagehide",
      safe(() => {
        if (visibleSince) visibleMs += Date.now() - visibleSince;
        visibleSince = 0;
        t.push(withPath({ name: "page.leave", activeMs: Math.min(Math.round(visibleMs), 3_600_000) }));
        t.flush(true);
      }),
    );

    // S12 design §3.4: ads run only on published pages (Rello's marketing pages and a host's own
    // tenant site), never on client portals (spoke_public) or in-app screens.
    if (published) {
      // S12 design §5.1 Rev 3: the ad-click keys ride on this page's first batch (the page.view below
      // sends it at once). No other query key is read. A bad value is dropped on its own.
      safe(() => {
        const q = new URLSearchParams(location.search);
        const params: Array<{ key: string; value: string }> = [];
        for (const key of AD_KEYS) {
          const value = q.get(key);
          if (value && AD_VALUE.test(value)) params.push({ key, value });
        }
        if (params.length) t.push({ name: "landing.adclick", pageId, params });
      })();
      // S12 design §8 Rev 3: the loader reports its decision; one ads.decision per pageId, later calls ignored.
      let told = 0;
      (w as Window & { __rt?: unknown }).__rt = {
        ads: safe((reason: unknown) => {
          if (!told && typeof reason == "string" && REASON.test(reason)) {
            told = 1;
            t.push({ name: "ads.decision", pageId, reason });
          }
        }),
      };
      // S12 design §3.1 (Rev 2: no GPC skip): the ads loader, once per document, after load and an
      // idle callback. The edge decides what it holds.
      if (d.readyState == "complete") idle();
      else w.addEventListener("load", idle);
    }
    view();
    t.retryParked();
  } catch {
    /* the page never knows */
  }
})();

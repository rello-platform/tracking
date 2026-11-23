/**
 * GD-3035 (plan §3.3 item 4): pages a tenant's CLIENTS use (Rello /c/[token], /d/[token],
 * /c/dashboard, the spoke portals) tag the script with surface = spoke_public, and on that
 * surface the page sends ONLY page.view. The script installs no scroll, click or pagehide
 * listener and no IntersectionObserver there, so scroll.depth, section.read, cta.click,
 * widget.use and page.leave cannot be produced at all, whatever the page holds.
 *
 * The other surfaces keep the v0.3.0 behaviour; the controls below pin what each one sends
 * for the same sequence of user actions.
 *
 * S12b (prompt 1784): the sequence also loads the page with ad-click keys in its URL, fires `load`
 * and the idle callback, and calls `__rt.ads`. On spoke_public none of the ads hook exists: no
 * `load` listener, no loader request, no `__rt`, no `landing.adclick`, no `ads.decision`. On
 * marketing and tenant_site the page.view gains `pageId` and `nav` and the loader is requested
 * once (S12 design §3.4, §8 Rev 3); in_app is unchanged.
 *
 * Runs the SHIPPED bundle (dist/script/s.js, rebuilt from src by `npm test`) in a VM with a
 * fake clock, so what is asserted is what the engine serves.
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, test } from "vitest";

const SRC = readFileSync("dist/script/s.js", "utf8");
const TEMPLATE = "/c/[token]";
const PATHNAME = "/c/tok-abc123XYZ";
const SEARCH = "?gclid=Cj0KCQiA_abc-123&fbclid=IwAR0abcdefgh&utm_source=x";

type Ev = { name: string; [k: string]: unknown };
type Listener = (ev: unknown) => void;

function boot(surface: string) {
  const winL: Record<string, Listener[]> = {};
  const docL: Record<string, Listener[]> = {};
  const on = (m: Record<string, Listener[]>) => (k: string, f: Listener) => void (m[k] ??= []).push(f);
  // Fake clock: the script's section wait (4 s) and the transport's flush timer (5 s) both go here.
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { f: () => void; due: number }>();
  // Between timers the fetch replies settle (microtasks drain), as in a browser's event loop.
  const drain = () => new Promise<void>((r) => setImmediate(r));
  const advance = async (ms: number) => {
    const end = now + ms;
    for (;;) {
      await drain();
      const next = [...timers.entries()].filter(([, t]) => t.due <= end).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!next) break;
      timers.delete(next[0]);
      now = next[1].due;
      next[1].f();
    }
    now = end;
  };
  const sent: Ev[] = [];
  const take = (body: string) => sent.push(...(JSON.parse(body) as { events: Ev[] }).events);
  const store = new Map<string, string>();
  const observers: Array<(entries: unknown[]) => void> = [];
  let ioConstructed = 0;
  class IO {
    constructor(cb: (entries: unknown[]) => void) {
      ioConstructed++;
      observers.push(cb);
    }
    observe() {}
  }
  class Element {
    constructor(
      public dataset: Record<string, string>,
      private self: string,
    ) {}
    closest(sel: string) {
      return sel === this.self ? this : null;
    }
  }
  const section = new Element({ section: "rates", topic: "refi" }, "[data-section]");
  const cta = new Element({ cta: "apply-now" }, "[data-cta]");
  const widget = new Element({ widget: "rate-calc", widgetAction: "change" }, "[data-widget]");
  const location = { pathname: PATHNAME, search: SEARCH, host: "example.test" };
  const appended: string[] = [];
  const idles: Array<() => void> = [];
  const document = {
    currentScript: { dataset: { surface, routes: `${TEMPLATE} /c/dashboard` } },
    visibilityState: "visible",
    title: "Portal",
    readyState: "interactive",
    createElement: (tag: string) => ({ tag, src: "" }),
    head: { appendChild: (el: { tag: string; src: string }) => (appended.push(`${el.tag} ${el.src}`), el) },
    querySelector: () => null,
    querySelectorAll: (sel: string) => (sel === "[data-section]" ? [section] : []),
    addEventListener: on(docL),
    documentElement: { scrollHeight: 1000 },
  };
  const window = {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    setTimeout: (f: () => void, ms: number) => (timers.set(++seq, { f, due: now + (ms || 0) }), seq),
    clearTimeout: (id: number) => void timers.delete(id),
    fetch: (_u: string, init: { body: string }) => (take(init.body), Promise.resolve({ ok: true, status: 204 })),
    crypto: { randomUUID: () => `id-${Math.random().toString(36).slice(2)}` },
    addEventListener: on(winL),
    scrollY: 0,
    innerHeight: 600,
    IntersectionObserver: IO,
    requestIdleCallback: (f: () => void) => void idles.push(f),
  };
  const history = { pushState() {}, replaceState() {} };
  const navigator = { sendBeacon: (_u: string, b: string) => (take(b), true) };
  vm.runInNewContext(SRC, { window, document, history, location, navigator, Element, IntersectionObserver: IO, URLSearchParams, console });
  const fire = (m: Record<string, Listener[]>, k: string, ev: unknown = {}) => (m[k] ?? []).forEach((f) => f(ev));

  /** The prompt's sequence: scroll to 100 %, a [data-section] visible for 4 s, a click on [data-cta] and on [data-widget], then pagehide. S12b: plus load, the idle callback and a loader's report. */
  const play = async () => {
    await drain();
    fire(winL, "load");
    idles.splice(0).forEach((f) => f());
    (window as { __rt?: { ads: (r: string) => void } }).__rt?.ads("served");
    window.scrollY = 400; // (400 + 600) / 1000 = 100 %
    fire(winL, "scroll");
    observers.forEach((cb) => cb([{ target: section, intersectionRatio: 1 }]));
    await advance(4000);
    fire(docL, "click", { target: cta });
    fire(docL, "click", { target: widget });
    fire(winL, "pagehide");
    await advance(60_000);
  };
  return { sent, play, winL, docL, io: () => ioConstructed, appended, rt: () => (window as { __rt?: unknown }).__rt };
}

/** activeMs is wall-clock time on the page; every other field is exact. */
const shape = (evs: Ev[]) => evs.map((e) => (e.name === "page.leave" ? { ...e, activeMs: typeof e.activeMs } : e));

describe("GD-3035: on spoke_public the page script sends page.view and nothing else", () => {
  test("spoke_public: scroll to 100 %, a section read, a CTA and a widget click, then pagehide → exactly one event, page.view with the template path", async () => {
    const h = boot("spoke_public");
    await h.play();
    expect(h.sent).toEqual([{ name: "page.view", pageType: "other", path: TEMPLATE }]);
    expect(h.appended).toEqual([]); // S12b: no loader request
  });

  test("spoke_public: no scroll, click or pagehide listener and no IntersectionObserver is installed", () => {
    const h = boot("spoke_public");
    expect(Object.keys(h.winL)).not.toContain("scroll");
    expect(Object.keys(h.winL)).not.toContain("pagehide");
    expect(Object.keys(h.docL)).not.toContain("click");
    expect(h.io()).toBe(0);
  });

  test("spoke_public (S12b): no load listener, no __rt, and nothing the ads hook would add", async () => {
    const h = boot("spoke_public");
    expect(Object.keys(h.winL)).not.toContain("load");
    expect(h.rt()).toBeUndefined();
    await h.play();
    expect(h.appended).toEqual([]);
    expect(h.sent.map((e) => e.name)).toEqual(["page.view"]);
    expect(Object.keys(h.winL).sort()).toEqual(["popstate"]);
    expect(Object.keys(h.docL).sort()).toEqual(["visibilitychange"]);
  });
});

describe("controls: every other surface sends what it sent at v0.3.0 (marketing and tenant_site plus S12b's ads)", () => {
  const FULL = (path: string, title: boolean): unknown[] => [
    ...(title ? [{ name: "landing.adclick", pageId: expect.any(String), params: [{ key: "gclid", value: "Cj0KCQiA_abc-123" }, { key: "fbclid", value: "IwAR0abcdefgh" }] }] : []),
    { name: "page.view", pageType: "other", ...(title ? { title: "Portal", pageId: expect.any(String), nav: "load" } : {}), path },
    { name: "scroll.depth", depth: 25, path },
    { name: "scroll.depth", depth: 50, path },
    { name: "scroll.depth", depth: 75, path },
    { name: "scroll.depth", depth: 100, path },
    { name: "section.read", sectionId: "rates", topic: "refi", path },
    { name: "cta.click", ctaId: "apply-now", path },
    { name: "widget.use", widgetId: "rate-calc", action: "change", path },
    { name: "page.leave", activeMs: "number", path },
  ];
  /** S12b: the loader's report rides in the batch after the first (before the scrolls flush). */
  const withDecision = (evs: unknown[]): unknown[] => [...evs.slice(0, 2), { name: "ads.decision", pageId: expect.any(String), reason: "served" }, ...evs.slice(2)];

  test.each([
    ["marketing", PATHNAME, true],
    ["tenant_site", PATHNAME, true],
    ["in_app", TEMPLATE, false],
  ] as const)("%s: the same sequence sends all nine events (marketing, tenant_site: plus landing.adclick and ads.decision)", async (surface, path, title) => {
    const h = boot(surface);
    await h.play();
    expect(shape(h.sent)).toEqual(title ? withDecision(FULL(path, title)) : FULL(path, title));
    expect(h.appended).toEqual(title ? ["script /t/a.v1.js"] : []);
  });

  test.each(["marketing", "tenant_site", "in_app"])("%s: the scroll, click and pagehide listeners and the IntersectionObserver are installed", (surface) => {
    const h = boot(surface);
    expect(Object.keys(h.winL)).toEqual(expect.arrayContaining(["scroll", "pagehide"]));
    expect(Object.keys(h.docL)).toContain("click");
    expect(h.io()).toBe(1);
  });
});

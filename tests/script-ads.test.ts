/**
 * S12b: the page script's ads hook, decision report and ad-click capture
 * (DESIGN-TRACKING-S12-ADS-LAYER §3.1, §3.4, §5.1 Rev 3, §8 Rev 3 reach block).
 *
 * Runs the SHIPPED bundle (dist/script/s.js, rebuilt from src by `npm test`) in a VM with a fake
 * clock and a fake idle callback. Asserts, on the published surfaces that run the hook
 * (marketing, tenant_site; §3.4):
 * - the loader `/t/a.v1.js` is requested once per document load, after `load` and an idle
 *   callback, never per SPA navigation, and with no GPC skip;
 * - `__rt.ads(reason)` gives exactly one `ads.decision {pageId, reason}` per pageId, in the next batch;
 * - a URL carrying any of the four ad-click keys puts one schema-valid `landing.adclick` on the
 *   first batch; no other query key is ever sent; a bad value is dropped and the view still sends;
 * - every event the script sends passes the package's own schemas.
 * spoke_public is covered in script-surface.test.ts; in_app is asserted here.
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, test } from "vitest";
import { AD_CLICK_KEYS, AD_CLICK_VALUE, CLIENT_EVENT_NAMES, parseClientEvent, parseEvent } from "../src/index";
import { common } from "./fixtures";

const SRC = readFileSync("dist/script/s.js", "utf8");
const GCLID = "Cj0KCQiA_abc-123.XYZ";

type Ev = { name: string; [k: string]: unknown };
type Listener = (ev: unknown) => void;

function boot(opts: { surface?: string; search?: string; gpc?: boolean; idle?: boolean; readyState?: string } = {}) {
  const surface = opts.surface ?? "marketing";
  const winL: Record<string, Listener[]> = {};
  const docL: Record<string, Listener[]> = {};
  const on = (m: Record<string, Listener[]>) => (k: string, f: Listener) => void (m[k] ??= []).push(f);
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { f: () => void; due: number }>();
  const idles: Array<() => void> = [];
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
  const batches: Array<{ gpc?: boolean; events: Ev[] }> = [];
  const take = (body: string) => batches.push(JSON.parse(body));
  const appended: string[] = [];
  const store = new Map<string, string>();
  const location = { pathname: "/pricing", search: opts.search ?? "", host: "example.test" };
  const document = {
    currentScript: { dataset: { surface, routes: "/pricing" } },
    readyState: opts.readyState ?? "interactive",
    visibilityState: "visible",
    title: "Pricing",
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: on(docL),
    createElement: (tag: string) => ({ tag, src: "" }),
    head: { appendChild: (el: { tag: string; src: string }) => (appended.push(`${el.tag} ${el.src}`), el) },
    documentElement: { scrollHeight: 1000 },
  };
  const window: Record<string, unknown> = {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    setTimeout: (f: () => void, ms: number) => (timers.set(++seq, { f, due: now + (ms || 0) }), seq),
    clearTimeout: (id: number) => void timers.delete(id),
    fetch: (_u: string, init: { body: string }) => (take(init.body), Promise.resolve({ ok: true, status: 204 })),
    crypto: { randomUUID: () => `id-${Math.random().toString(36).slice(2)}` },
    addEventListener: on(winL),
    scrollY: 0,
    innerHeight: 600,
  };
  if (opts.idle !== false) window.requestIdleCallback = (f: () => void) => idles.push(f);
  const pathHistory = {
    pushState(_s: unknown, _t: string, u?: string) {
      if (u) location.pathname = u;
    },
    replaceState(_s: unknown, _t: string, u?: string) {
      if (u) location.pathname = u;
    },
  };
  const navigator = { sendBeacon: (_u: string, b: string) => (take(b), true), globalPrivacyControl: opts.gpc === true };
  vm.runInNewContext(SRC, { window, document, history: pathHistory, location, navigator, URLSearchParams, Element: class {}, console });
  const fire = (m: Record<string, Listener[]>, k: string, ev: unknown = {}) => (m[k] ?? []).forEach((f) => f(ev));
  return {
    window,
    document,
    history: pathHistory,
    appended,
    batches,
    events: () => batches.flatMap((b) => b.events),
    load: () => fire(winL, "load"),
    runIdle: () => idles.splice(0).forEach((f) => f()),
    idles,
    advance,
    drain,
    pagehide: () => fire(winL, "pagehide"),
    winL,
    rt: () => window.__rt as { ads: (r: unknown) => void } | undefined,
  };
}

const LOADER = "script /t/a.v1.js";

describe("the loader request: once per document, after load and idle (§3.1, §8 Rev 3)", () => {
  test.each(["marketing", "tenant_site"])("%s: nothing before load; nothing before idle; then exactly one /t/a.v1.js", async (surface) => {
    const h = boot({ surface });
    expect(h.appended).toEqual([]);
    h.load();
    expect(h.appended).toEqual([]);
    expect(h.idles).toHaveLength(1);
    h.runIdle();
    expect(h.appended).toEqual([LOADER]);
  });
  test("not per SPA navigation: pushState, replaceState and popstate after the load add no second request", async () => {
    const h = boot();
    h.load();
    h.runIdle();
    h.history.pushState({}, "", "/rates");
    h.history.replaceState({}, "", "/about");
    (h.winL.popstate ?? []).forEach((f) => f({}));
    h.runIdle();
    await h.advance(10_000);
    expect(h.appended).toEqual([LOADER]);
    expect(h.events().filter((e) => e.name === "page.view")).toHaveLength(4);
  });
  test("no GPC skip (Rev 2, GD-2870): a GPC browser still requests the loader, and its batches carry gpc", async () => {
    const h = boot({ gpc: true });
    h.load();
    h.runIdle();
    expect(h.appended).toEqual([LOADER]);
    expect(h.batches[0]!.gpc).toBe(true);
  });
  test("no requestIdleCallback (Safari): a timer stands in for idle, still after load", async () => {
    const h = boot({ idle: false });
    await h.advance(10);
    expect(h.appended).toEqual([]);
    h.load();
    await h.advance(10);
    expect(h.appended).toEqual([LOADER]);
  });
  test("a script that starts after load (readyState complete) still requests once, after idle", () => {
    const h = boot({ readyState: "complete" });
    expect(h.appended).toEqual([]);
    h.runIdle();
    h.load();
    h.runIdle();
    expect(h.appended).toEqual([LOADER]);
  });
});

describe("the decision report: __rt.ads(reason) → one ads.decision per pageId (§8 Rev 3)", () => {
  test("one ads.decision {pageId, reason}, in the next batch, with the page view's pageId", async () => {
    const h = boot();
    const pv = h.events().find((e) => e.name === "page.view")!;
    expect(pv).toMatchObject({ nav: "load", pageId: expect.any(String) });
    h.rt()!.ads("served");
    expect(h.events().some((e) => e.name === "ads.decision")).toBe(false); // buffered, not yet sent
    await h.advance(5000);
    expect(h.events().filter((e) => e.name === "ads.decision")).toEqual([{ name: "ads.decision", pageId: pv.pageId, reason: "served" }]);
  });
  test("repeat calls for one pageId count once (the first)", async () => {
    const h = boot();
    h.rt()!.ads("consent_refresh");
    h.rt()!.ads("served");
    h.rt()!.ads("consent_refresh");
    h.pagehide();
    await h.advance(10_000);
    expect(h.events().filter((e) => e.name === "ads.decision").map((e) => e.reason)).toEqual(["consent_refresh"]);
  });
  test("an SPA navigation keeps the pageId: no second decision, and the view says nav spa", async () => {
    const h = boot();
    h.rt()!.ads("served");
    h.history.pushState({}, "", "/rates");
    h.rt()!.ads("switch_off");
    await h.advance(10_000);
    const views = h.events().filter((e) => e.name === "page.view");
    expect(views.map((e) => e.nav)).toEqual(["load", "spa"]);
    expect(new Set(views.map((e) => e.pageId)).size).toBe(1);
    expect(h.events().filter((e) => e.name === "ads.decision")).toHaveLength(1);
  });
  test("a call that is not a reason is ignored and does not use up the report", async () => {
    const h = boot();
    for (const bad of [undefined, 7, {}, "Served!", "x".repeat(40)]) h.rt()!.ads(bad);
    h.rt()!.ads("gpc_header");
    await h.advance(10_000);
    expect(h.events().filter((e) => e.name === "ads.decision").map((e) => e.reason)).toEqual(["gpc_header"]);
  });
  test("a loader's no-tag answer, run as the engine will serve it, reports through __rt", async () => {
    const h = boot();
    vm.runInNewContext('window.__rt&&__rt.ads("region_no_consent_ui")', { window: h.window, __rt: h.window.__rt });
    await h.advance(10_000);
    expect(h.events().filter((e) => e.name === "ads.decision").map((e) => e.reason)).toEqual(["region_no_consent_ui"]);
  });
});

describe("landing.adclick on the first batch (§5.1 Rev 3)", () => {
  test("the four keys only: one landing.adclick on the first batch, schema-valid; no other query key is sent", () => {
    const h = boot({ search: `?utm_source=fb&gclid=${GCLID}&email=a%40b.c&fbclid=IwAR0abcdefgh&q=secret` });
    const first = h.batches[0]!.events;
    expect(first.map((e) => e.name)).toEqual(["landing.adclick", "page.view"]);
    const ac = first[0]!;
    expect(ac).toEqual({ name: "landing.adclick", pageId: first[1]!.pageId, params: [{ key: "gclid", value: GCLID }, { key: "fbclid", value: "IwAR0abcdefgh" }] });
    expect(parseClientEvent(ac).ok).toBe(true);
    const all = JSON.stringify(h.batches);
    for (const leak of ["utm_source", "secret", "a@b.c", "a%40b.c", "email"]) expect(all).not.toContain(leak);
  });
  test("a malformed or over-long value is dropped; the page view still sends", () => {
    const h = boot({ search: `?gclid=short&gbraid=${"a".repeat(513)}&fbclid=bad%20value` });
    expect(h.batches[0]!.events.map((e) => e.name)).toEqual(["page.view"]);
    const h2 = boot({ search: `?gclid=short&wbraid=wb_ok_12345` });
    expect(h2.batches[0]!.events[0]).toMatchObject({ name: "landing.adclick", params: [{ key: "wbraid", value: "wb_ok_12345" }] });
  });
  test("no ad key → no landing.adclick; an SPA navigation never adds one", () => {
    const h = boot({ search: "?plan=pro" });
    h.history.pushState({}, "", "/rates?gclid=" + GCLID);
    expect(h.events().some((e) => e.name === "landing.adclick")).toBe(false);
  });
  test("the script's key list and value shape are the package's AD_CLICK_KEYS / AD_CLICK_VALUE", () => {
    for (const key of AD_CLICK_KEYS) {
      const h = boot({ search: `?${key}=${GCLID}` });
      expect(h.batches[0]!.events[0]).toMatchObject({ name: "landing.adclick", params: [{ key, value: GCLID }] });
    }
    expect(AD_CLICK_VALUE.source).toBe("^[A-Za-z0-9._-]{8,512}$");
  });
});

describe("which surfaces run the hook (§3.4: marketing and tenant_site; never portals or in-app)", () => {
  test("in_app: no loader, no __rt, no landing.adclick, and page.view carries no pageId or nav", async () => {
    const h = boot({ surface: "in_app", search: `?gclid=${GCLID}` });
    h.load();
    h.runIdle();
    await h.advance(10_000);
    expect(h.appended).toEqual([]);
    expect(h.rt()).toBeUndefined();
    expect(Object.keys(h.winL)).not.toContain("load");
    expect(h.events().map((e) => e.name)).toEqual(["page.view"]);
    expect(h.events()[0]).not.toHaveProperty("pageId");
    expect(h.events()[0]).not.toHaveProperty("nav");
  });
});

describe("everything the script sends passes the package's schemas", () => {
  test.each(["marketing", "tenant_site"])("%s: page.view (with pageId, nav) as a stored event; landing.adclick and ads.decision as client events", async (surface) => {
    const h = boot({ surface, search: `?gclid=${GCLID}` });
    h.rt()!.ads("served");
    h.history.pushState({}, "", "/pricing");
    await h.advance(10_000);
    const evs = h.events();
    expect(evs.map((e) => e.name).sort()).toEqual(["ads.decision", "landing.adclick", "page.view", "page.view"]);
    for (const e of evs) {
      const r = (CLIENT_EVENT_NAMES as readonly string[]).includes(e.name) ? parseClientEvent(e) : parseEvent({ ...common({ surface }), ...e });
      expect(r.ok, `${e.name}: ${JSON.stringify(r)}`).toBe(true);
    }
  });
});

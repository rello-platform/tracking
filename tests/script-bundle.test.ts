/**
 * GD-2739: the SHIPPED bundle (dist/script/s.js, built by `npm test`) never lets an error
 * reach the page. It runs in a browser-like VM harness with a hostile localStorage, then
 * every callback the script installs is driven, and every history call is made.
 *
 * The one thing that MUST still reach the caller is an error from the native history
 * call itself: tracking wraps pushState/replaceState and must not swallow the page's own error.
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, test } from "vitest";

const SRC = readFileSync("dist/script/s.js", "utf8");

type Listener = (ev: unknown) => void;

function boot(opts: { rtq?: string | null; storageThrows?: boolean; fetchThrows?: boolean; beaconThrows?: boolean; nativeThrows?: Error } = {}) {
  const listeners: Record<string, Listener[]> = {};
  const add = (k: string, f: Listener) => (listeners[k] ??= []).push(f);
  const timers: Array<() => void> = [];
  const store = new Map<string, string>();
  if (opts.rtq !== undefined && opts.rtq !== null) store.set("rt_q", opts.rtq);
  const sent: string[] = [];
  let ioCallback: ((entries: unknown[]) => void) | undefined;
  const nativeCalls: string[] = [];
  const location = { pathname: "/pricing", host: "example.test" };
  const section = { dataset: { section: "rates", topic: "refi" } };
  const localStorage = {
    getItem: (k: string) => {
      if (opts.storageThrows) throw new Error("storage blocked");
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (opts.storageThrows) throw new Error("storage blocked");
      store.set(k, v);
    },
    removeItem: (k: string) => void store.delete(k),
  };
  // The script reads IntersectionObserver as a GLOBAL, so it must be on the context, not only on window.
  class IO {
    constructor(cb: (entries: unknown[]) => void) {
      ioCallback = cb;
    }
    observe() {}
  }
  class Element {
    closest() {
      return null;
    }
  }
  const document = {
    currentScript: { dataset: { surface: "marketing" } },
    visibilityState: "visible",
    title: "Pricing",
    querySelector: () => null,
    querySelectorAll: () => [section],
    addEventListener: add,
    documentElement: { scrollHeight: 1000 },
  };
  const window = {
    localStorage,
    setTimeout: (f: () => void) => (timers.push(f), timers.length),
    clearTimeout: () => {},
    fetch: (_u: string, init: { body: string }) => {
      sent.push(init.body);
      if (opts.fetchThrows) throw new Error("fetch blocked");
      return Promise.resolve({ ok: true, status: 204 });
    },
    crypto: { randomUUID: () => `id-${Math.random().toString(36).slice(2)}` },
    addEventListener: add,
    scrollY: 900,
    innerHeight: 600,
    IntersectionObserver: IO,
  };
  const history = {
    pushState(_s: unknown, _t: string, url?: string) {
      nativeCalls.push(`push ${url}`);
      if (opts.nativeThrows) throw opts.nativeThrows;
      if (url) location.pathname = url;
    },
    replaceState(_s: unknown, _t: string, url?: string) {
      nativeCalls.push(`replace ${url}`);
      if (opts.nativeThrows) throw opts.nativeThrows;
      if (url) location.pathname = url;
    },
  };
  const navigator = {
    sendBeacon: (_u: string, b: string) => {
      if (opts.beaconThrows) throw new Error("beacon blocked");
      sent.push(b);
      return true;
    },
  };
  vm.runInNewContext(SRC, { window, document, history, location, navigator, Element, IntersectionObserver: IO, console });
  // Prove the script actually booted (it swallows its own boot errors, so a harness gap would
  // otherwise make every "no throw" assertion pass vacuously): boot sends the first page.view.
  if (!sent.some((b) => b.includes('"page.view"'))) throw new Error("harness: the script did not boot (no page.view sent)");
  const fire = (k: string, ev: unknown = {}) => (listeners[k] ?? []).forEach((f) => f(ev));
  const runTimers = () => {
    for (let i = 0; i < 50 && timers.length; i++) timers.splice(0).forEach((f) => f());
  };
  return { history, store, sent, nativeCalls, fire, runTimers, io: () => ioCallback, document, listeners };
}

const HOSTILE = ["[null]", '{"a":1}', '[{"b":', '[{"b":"x","events":"no"}]', "[1,\"s\",[]]", '[{"b":"ok","events":[null,7,{"name":3}]}]'];

/** Drive every callback and history call; return the first error that reached "the page". */
function driveEverything(h: ReturnType<typeof boot>): unknown {
  const steps: Array<() => void> = [
    () => h.history.pushState({}, "", "/rates"),
    () => h.history.replaceState({}, "", "/rates/check"),
    () => h.history.replaceState({}, "", "/rates/check"),
    () => h.fire("popstate"),
    () => h.fire("scroll"),
    () => h.fire("click", { target: null }),
    () => h.fire("click", { target: {} }),
    () => h.io()?.([{ target: { dataset: { section: "rates" } }, intersectionRatio: 1 }, null, { target: null }]),
    () => h.runTimers(),
    () => {
      h.document.visibilityState = "hidden";
      h.fire("visibilitychange");
    },
    () => h.fire("pagehide"),
    () => h.runTimers(),
  ];
  for (const s of steps) {
    try {
      s();
    } catch (e) {
      return e;
    }
  }
  return undefined;
}

describe("GD-2739: the shipped script never throws into the page", () => {
  test.each(HOSTILE)("rt_q = %s before the script boots", (rtq) => {
    const h = boot({ rtq });
    expect(driveEverything(h)).toBeUndefined();
  });

  test.each(HOSTILE)("rt_q = %s written after the script booted", (rtq) => {
    const h = boot();
    h.store.set("rt_q", rtq);
    expect(driveEverything(h)).toBeUndefined();
    expect(h.nativeCalls).toContain("push /rates");
  });

  test("storage, fetch and sendBeacon that throw", () => {
    expect(driveEverything(boot({ storageThrows: true, fetchThrows: true, beaconThrows: true }))).toBeUndefined();
  });

  test("an error from the NATIVE history call reaches its caller unchanged", () => {
    const err = new Error("SecurityError from the browser");
    const h = boot({ nativeThrows: err });
    expect(() => h.history.pushState({}, "", "/x")).toThrow(err);
    expect(() => h.history.replaceState({}, "", "/y")).toThrow(err);
  });

  test("a malformed rt_q is dropped, never sent: what is sent is well-formed", () => {
    const h = boot({ rtq: '[null,{"b":"ok1","v":"vvvvvvvvvvvvvvvvvvvvvv","events":[{"name":"page.view","pageType":"home","path":"/"}]},{"b":5}]' });
    h.runTimers(); // the 1 s retry of earlier batches
    const bodies = h.sent.map((s) => JSON.parse(s));
    expect(bodies.every((b) => typeof b.b === "string" && Array.isArray(b.events) && b.events.every((e: { name: unknown }) => typeof e?.name === "string"))).toBe(true);
    expect(bodies.some((b) => b.b === "ok1")).toBe(true);
  });

  test("replaceState to the same path is not a new page view; to a new path it is", () => {
    const h = boot();
    const views = () => h.sent.flatMap((s) => JSON.parse(s).events).filter((e: { name: string }) => e.name === "page.view").length;
    const n0 = views();
    h.history.replaceState({}, "", "/pricing");
    expect(views()).toBe(n0);
    h.history.replaceState({}, "", "/about");
    expect(views()).toBe(n0 + 1);
  });

  test("every batch carries the same stable client visitor id v, kept in localStorage", () => {
    const h = boot();
    h.history.pushState({}, "", "/a");
    h.history.pushState({}, "", "/b");
    const vs = h.sent.map((s) => JSON.parse(s).v);
    expect(vs.length).toBeGreaterThan(1);
    expect(new Set(vs).size).toBe(1);
    expect(vs[0]).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(h.store.get("rt_v")).toBe(vs[0]);
  });
});

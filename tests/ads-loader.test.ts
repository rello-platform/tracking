/**
 * The ads loader body `/t/a.v1.js` (DESIGN-TRACKING-S12-ADS-LAYER §3.1, §3.2, §3.5, §8 Rev 3).
 * The engine decides per request WHETHER to serve it (that decision is the engine half's);
 * the package owns WHAT is served, so its bytes are reviewed and size-tested here:
 * - a no-tag answer is about 60 bytes that calls `window.__rt&&__rt.ads("<reason>")`;
 * - a served loader calls `__rt.ads("served")` before writing any tag, sets Google consent mode's
 *   default before `config`, writes the Meta Pixel and the Google tag with their ids, and fires
 *   PageView only; a browser reporting GPC gets all four consent types denied and no Meta Pixel;
 * - ≤ 2 KB gzip (§3.5), with every id checked so a config value can never become code.
 */
import vm from "node:vm";
import { gzipSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import { ADS_LOADER_GZIP_LIMIT_BYTES, ADS_REASONS, ADS_VENDOR_HOSTNAMES, adsLoaderScript, adsNoTagScript } from "../src/index";

const META = "123456789012345";
const GOOGLE = "G-ABC123XYZ9";

function run(src: string, opts: { gpc?: boolean; noRt?: boolean } = {}) {
  const log: string[] = [];
  const appended: string[] = [];
  const window: Record<string, unknown> = { navigator: { globalPrivacyControl: opts.gpc === true } };
  if (!opts.noRt) window.__rt = { ads: (r: string) => log.push(`ads:${r}`) };
  const document = {
    createElement: () => ({ src: "", async: false }),
    head: { appendChild: (s: { src: string }) => (appended.push(s.src), log.push(`script:${s.src}`), s) },
  };
  window.window = window;
  window.document = document;
  vm.runInNewContext(src, window);
  const dl = (window.dataLayer as IArguments[] | undefined)?.map((a) => Array.from(a)) ?? [];
  const fbq = window.fbq as { queue?: IArguments[] } | undefined;
  return { log, appended, dl, fbq: fbq?.queue?.map((a) => Array.from(a)) ?? null, window };
}

describe("the no-tag answer", () => {
  test.each(ADS_REASONS.filter((r) => r !== "served"))("%s: a ~60-byte script that reports the reason once", (reason) => {
    const src = adsNoTagScript(reason);
    expect(src).toBe(`window.__rt&&__rt.ads("${reason}")`);
    expect(src.length).toBeLessThanOrEqual(64);
    expect(run(src).log).toEqual([`ads:${reason}`]);
  });
  test("with no s.js on the page (no __rt) it does nothing and throws nothing", () => {
    expect(() => run(adsNoTagScript("switch_off"), { noRt: true })).not.toThrow();
  });
  test.each(["served", "gpc_client", "", 'x");alert(1);("'])("refuses %j: never a reason outside the list, never 'served' with no tags", (r) => {
    expect(() => adsNoTagScript(r as never)).toThrow(RangeError);
  });
});

describe("the served loader", () => {
  test("reports 'served' before writing any tag; consent default before config; PageView only", () => {
    const h = run(adsLoaderScript({ metaPixelId: META, googleTagId: GOOGLE }));
    expect(h.log[0]).toBe("ads:served");
    expect(h.appended.sort()).toEqual(["https://connect.facebook.net/en_US/fbevents.js", `https://www.googletagmanager.com/gtag/js?id=${GOOGLE}`]);
    const cmds = h.dl.map((a) => a.slice(0, 2).map(String).join(" "));
    expect(cmds.indexOf("consent default")).toBe(0);
    expect(cmds.indexOf(`config ${GOOGLE}`)).toBeGreaterThan(0);
    expect(h.dl[0]![2]).toEqual({ ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
    expect(h.fbq).toEqual([["init", META], ["track", "PageView"]]);
  });
  test("GPC reported by the browser: all four consent types denied, and no Meta Pixel (§3.2 Rev 2)", () => {
    const h = run(adsLoaderScript({ metaPixelId: META, googleTagId: GOOGLE }), { gpc: true });
    expect(h.log[0]).toBe("ads:served");
    expect(h.dl[0]![2]).toEqual({ ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    expect(h.fbq).toBeNull();
    expect(h.appended.some((u) => u.includes("facebook"))).toBe(false);
  });
  test("only the vendors configured are written", () => {
    expect(run(adsLoaderScript({ googleTagId: GOOGLE })).appended).toEqual([`https://www.googletagmanager.com/gtag/js?id=${GOOGLE}`]);
    const m = run(adsLoaderScript({ metaPixelId: META }));
    expect(m.appended).toEqual(["https://connect.facebook.net/en_US/fbevents.js"]);
    expect(m.dl).toEqual([]);
  });
  test("a second loader on the same page does not re-bootstrap the Meta Pixel", () => {
    const src = adsLoaderScript({ metaPixelId: META });
    const h = run(src);
    vm.runInNewContext(src, h.window);
    expect(h.appended).toHaveLength(1);
  });
  test.each([
    ["no vendor at all", {}],
    ["a Meta id with a quote", { metaPixelId: '1234567"+alert(1)+"' }],
    ["a Meta id that is not digits", { metaPixelId: "abc12345" }],
    ["a Google id in lower case", { googleTagId: "g-abc123" }],
    ["a Google id with a script break", { googleTagId: "G-ABC</script>" }],
    ["a Google id with an unknown prefix", { googleTagId: "UA-1234567-1" }],
  ])("refuses %s (a config value can never become code)", (_l, cfg) => {
    expect(() => adsLoaderScript(cfg as never)).toThrow(RangeError);
  });
  test(`≤ 2 KB gzip with both vendors at their longest ids (§3.5)`, () => {
    const src = adsLoaderScript({ metaPixelId: "9".repeat(20), googleTagId: `AW-${"Z".repeat(20)}` });
    const gz = gzipSync(Buffer.from(src), { level: 9 }).length;
    expect(ADS_LOADER_GZIP_LIMIT_BYTES).toBe(2048);
    expect(gz, `a.v1.js is ${gz} B gzip`).toBeLessThanOrEqual(ADS_LOADER_GZIP_LIMIT_BYTES);
  });
  test("the vendor hostname list names the two vendors the loader writes", () => {
    const src = adsLoaderScript({ metaPixelId: META, googleTagId: GOOGLE });
    expect(ADS_VENDOR_HOSTNAMES.filter((h) => src.includes(h)).sort()).toEqual(["connect.facebook.net", "www.googletagmanager.com"]);
  });
});

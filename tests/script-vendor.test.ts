/**
 * S12 design §3.5: third-party tags are never bundled, proxied or inlined. Every built same-origin
 * page script (`dist/script/s*.js`, rebuilt by `npm test`) must carry no vendor hostname, so the
 * 3 KB budget can't be spent on vendor code by accident. Vendor bytes load only from the vendors'
 * own origins, through the loader (`/t/a.v1.js`), after load and idle.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { ADS_VENDOR_HOSTNAMES, adsLoaderScript } from "../src/index";

const SCRIPTS = readdirSync("dist/script").filter((f) => /^s.*\.js$/.test(f));
const VENDORISH = /facebook|fbevents|googletag|gtag\/js|google-analytics|googleadservices|doubleclick/i;

describe("s.*.js carries no vendor hostname (§3.5 build test)", () => {
  test("there is a built page script to check", () => {
    expect(SCRIPTS).toContain("s.js");
  });
  test.each(SCRIPTS)("%s: no vendor hostname, no vendor-shaped string", (f) => {
    const src = readFileSync(`dist/script/${f}`, "utf8");
    expect(ADS_VENDOR_HOSTNAMES.filter((h) => src.includes(h))).toEqual([]);
    expect(src.match(VENDORISH)).toBeNull();
  });
  test("positive control: the same checks find the vendors in the loader body", () => {
    const src = adsLoaderScript({ metaPixelId: "123456789012345", googleTagId: "G-ABC123XYZ9" });
    expect(ADS_VENDOR_HOSTNAMES.filter((h) => src.includes(h)).length).toBeGreaterThan(0);
    expect(src.match(VENDORISH)).not.toBeNull();
  });
});

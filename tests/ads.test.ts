/**
 * S12b package half (DESIGN-TRACKING-S12-ADS-LAYER §3.1, §3.5, §5.1, §8 Rev 3 reach block):
 * the ads constants, the two client events the page script sends (`landing.adclick`,
 * `ads.decision`), and the ad-click reader the edge and the script share.
 */
import { describe, expect, test } from "vitest";
import {
  ADS_LOADER_PATH,
  ADS_REASONS,
  ADS_VENDORS,
  AD_CLICK_KEYS,
  CLIENT_EVENT_NAMES,
  CLIENT_EVENT_SCHEMAS,
  RTK_LETTERS,
  RTK_RESERVED_LETTERS,
  adClickParams,
  findNonStrictObjects,
  findUnboundedStrings,
  parseClientEvent,
} from "../src/index";

const PAGE = "3f0e8a52-6d1b-4c1e-9a77-2b9d6c0f4e11";
const GCLID = "Cj0KCQiA_abc-123.XYZ";

describe("the ads constants", () => {
  test("ADS_VENDORS starts empty (§3.1: adding a vendor is a package release)", () => {
    expect(ADS_VENDORS).toEqual([]);
  });
  test("the rtk_<letter>_ letter set is t, c, p; f is reserved for T4 and not in use (§3.1 Rev 5 item 2)", () => {
    expect([...RTK_LETTERS]).toEqual(["t", "c", "p"]);
    expect([...RTK_RESERVED_LETTERS]).toEqual(["f"]);
    expect(RTK_LETTERS).not.toContain("f");
  });
  test("the four ad-click keys (§5.1)", () => {
    expect([...AD_CLICK_KEYS]).toEqual(["gclid", "gbraid", "wbraid", "fbclid"]);
  });
  test("the loader reasons, in the decision's precedence order (§3.1 Rev 3 item 2, Rev 4 item 1, Rev 5 host-owner rule)", () => {
    expect([...ADS_REASONS]).toEqual([
      "served",
      "switch_off",
      "host_owner_changed",
      "region_no_consent_ui",
      "gpc_header",
      "opted_out",
      "optout_unknown",
      "identity_overflow",
      "pending_identity",
      "consent_refresh",
    ]);
  });
  test("the loader is one constant same-origin URL with no query (§3.1 Rev 2 item 1)", () => {
    expect(ADS_LOADER_PATH).toBe("/t/a.v1.js");
  });
});

describe("landing.adclick (§5.1 Rev 3, the carrier)", () => {
  const ok = { name: "landing.adclick", pageId: PAGE, params: [{ key: "gclid", value: GCLID }] };
  test("a valid event is accepted", () => {
    expect(parseClientEvent(ok)).toEqual({ ok: true, event: ok });
    expect(parseClientEvent({ ...ok, params: AD_CLICK_KEYS.map((key) => ({ key, value: GCLID })) }).ok).toBe(true);
  });
  test.each([
    ["an extra key on the event", { ...ok, props: {} }],
    ["an extra key on a param", { ...ok, params: [{ key: "gclid", value: GCLID, x: 1 }] }],
    ["a key outside the four", { ...ok, params: [{ key: "utm_source", value: GCLID }] }],
    ["a repeated key", { ...ok, params: [{ key: "gclid", value: GCLID }, { key: "gclid", value: GCLID }] }],
    ["no params", { ...ok, params: [] }],
    ["five params", { ...ok, params: [...AD_CLICK_KEYS.map((key) => ({ key, value: GCLID })), { key: "gclid", value: GCLID }] }],
    ["a value under 8 characters", { ...ok, params: [{ key: "gclid", value: "abc" }] }],
    ["a value over 512 characters", { ...ok, params: [{ key: "gclid", value: "a".repeat(513) }] }],
    ["a value with a character outside the set", { ...ok, params: [{ key: "gclid", value: "abc def ghi" }] }],
    ["a pageId that is not an id", { ...ok, pageId: "a b" }],
  ])("refused: %s", (_label, e) => {
    expect(parseClientEvent(e).ok).toBe(false);
  });
});

describe("ads.decision (§8 Rev 3 reach block)", () => {
  test.each([...["served", "switch_off", "consent_refresh", "pending_identity"]])("reason %s is accepted", (reason) => {
    expect(parseClientEvent({ name: "ads.decision", pageId: PAGE, reason }).ok).toBe(true);
  });
  test.each([["an unknown reason", "gpc_client"], ["an empty reason", ""], ["a reason with text", "served; drop"]])("refused: %s", (_l, reason) => {
    expect(parseClientEvent({ name: "ads.decision", pageId: PAGE, reason }).ok).toBe(false);
  });
  test("an extra key is refused", () => {
    expect(parseClientEvent({ name: "ads.decision", pageId: PAGE, reason: "served", url: "/x" }).ok).toBe(false);
  });
});

describe("the client-event guards (plan §3.3 item 5)", () => {
  test("exactly two client events, each schema strict with every string bounded", () => {
    expect([...CLIENT_EVENT_NAMES]).toEqual(["landing.adclick", "ads.decision"]);
    for (const n of CLIENT_EVENT_NAMES) {
      expect(findUnboundedStrings(CLIENT_EVENT_SCHEMAS[n]), n).toEqual([]);
      expect(findNonStrictObjects(CLIENT_EVENT_SCHEMAS[n]), n).toEqual([]);
    }
  });
  test("an unknown client event name is refused", () => {
    expect(parseClientEvent({ name: "page.view", pageId: PAGE }).ok).toBe(false);
    expect(parseClientEvent(null).ok).toBe(false);
  });
});

describe("adClickParams: the four keys only, each value checked on its own (§5.1)", () => {
  test("reads the four keys and nothing else", () => {
    expect(adClickParams(`?utm_source=x&gclid=${GCLID}&email=a%40b.c&fbclid=IwAR0abcdefgh&q=secret`)).toEqual([
      { key: "gclid", value: GCLID },
      { key: "fbclid", value: "IwAR0abcdefgh" },
    ]);
  });
  test("a malformed or over-long value is dropped on its own; the others stay", () => {
    expect(adClickParams(`?gclid=short&gbraid=${"a".repeat(513)}&wbraid=ok_value_1&fbclid=bad%20value`)).toEqual([{ key: "wbraid", value: "ok_value_1" }]);
  });
  test("the first value of a repeated key is the one read, so keys stay unique", () => {
    expect(adClickParams(`?gclid=${GCLID}&gclid=second_value`)).toEqual([{ key: "gclid", value: GCLID }]);
  });
  test("no key, an empty query, or a value that is not a string → []", () => {
    expect(adClickParams("")).toEqual([]);
    expect(adClickParams("?a=1")).toEqual([]);
    expect(adClickParams(new URLSearchParams(`gclid=${GCLID}`))).toEqual([{ key: "gclid", value: GCLID }]);
  });
  test("what it returns always passes the landing.adclick schema", () => {
    const params = adClickParams(`?gclid=${GCLID}&gbraid=gb_123456789&wbraid=wb.123456789&fbclid=fb-123456789`);
    expect(params).toHaveLength(4);
    expect(parseClientEvent({ name: "landing.adclick", pageId: PAGE, params }).ok).toBe(true);
  });
});

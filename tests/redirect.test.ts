import { describe, expect, test } from "vitest";
import { redirectAttribution, redirectLocation } from "../src/redirect";

const at = (p: string) => redirectLocation(`https://hellorello.app${p}`);

describe("/t/c redirect (plan §2.4, Rev 3 GD-2706)", () => {
  test("removes only rg and r, and keeps the rest of the query", () => {
    expect(at("/t/c/pricing?rg=cmp_1&r=r1.a.b")).toBe("/pricing");
    expect(at("/t/c/pricing?plan=pro&rg=cmp_1&r=r1.a.b")).toBe("/pricing?plan=pro");
    expect(at("/t/c/rates/check?rg=x&zip=84101&r=y&term=30")).toBe("/rates/check?zip=84101&term=30");
  });
  test("/t/c alone goes to /", () => {
    expect(at("/t/c?rg=x")).toBe("/");
    expect(at("/t/c/?rg=x")).toBe("/");
  });
  test.each([
    "/t/c//evil.example/x",
    "/t/c/%2F%2Fevil.example",
    "/t/c/%5Cevil.example",
    "/t/c/https:%2F%2Fevil.example",
    "/t/c/javascript:alert(1)",
    "/t/c/%0d%0aSet-Cookie:x",
  ])("a value that is not a same-host path goes to / (%s)", (p) => {
    expect(at(p)).toBe("/");
  });
  test("a path outside /t/c goes to /", () => {
    expect(at("/t/cpricing")).toBe("/");
    expect(at("/pricing")).toBe("/");
  });
  test("an unparseable URL goes to /", () => {
    expect(redirectLocation("not a url")).toBe("/");
  });
  test("the attribution is read separately and never shapes the Location", () => {
    expect(redirectAttribution("https://hellorello.app/t/c/pricing?rg=cmp_1&r=r1.a.b")).toEqual({ rg: "cmp_1", r: "r1.a.b" });
    expect(redirectAttribution("https://hellorello.app/t/c/pricing")).toEqual({});
  });
});

/**
 * GD-2743: the /t/c rejection policy, stated exactly.
 *
 * RULE. The destination is the path after /t/c, percent-decoded once. It is REJECTED when the
 * decoded path contains "//" anywhere (leading or internal, written or %2F-encoded), a backslash,
 * a control character, or a scheme-shaped first segment; or when it can't be decoded. A REJECTED
 * destination goes to bare "/", with no query at all: nothing from a hostile or malformed link
 * is carried. An ACCEPTED destination keeps its path as written and every query parameter except
 * rg and r. A URL that is not under /t/c, or can't be parsed, also goes to bare "/".
 */
import { describe, expect, test } from "vitest";
import { redirectLocation } from "../src/redirect";

const at = (p: string) => redirectLocation(`https://hellorello.app${p}`);

describe("GD-2743 rejection policy", () => {
  test.each([
    "/t/c/a//b",
    "/t/c/a%2F%2Fb",
    "/t/c/a/%2Fb",
    "/t/c/a%2f/b",
    "/t/c/a//b?keep=1&rg=x",
    "/t/c/%2F%2Fevil.test?keep=1&rg=x&r=y",
    "/t/c//evil.test?keep=1",
    "/t/c/%5Cevil.test?keep=1",
    "/t/c/javascript:alert(1)?keep=1",
    "/t/c/%E0%A4%A?keep=1",
  ])("REJECTED → bare / with no query (%s)", (p) => {
    expect(at(p)).toBe("/");
  });

  test.each([
    ["/t/c/a/b?keep=1&rg=x&r=y", "/a/b?keep=1"],
    ["/t/c/a%2Fb?keep=1", "/a%2Fb?keep=1"],
    ["/t/c/caf%C3%A9?x=1", "/caf%C3%A9?x=1"],
    ["/t/c?plan=pro&rg=x", "/?plan=pro"],
  ])("ACCEPTED keeps the path as written and the query minus rg/r (%s)", (p, loc) => {
    expect(at(p)).toBe(loc);
  });

  test("a dot segment is resolved by the URL parser before the check, so it can't climb out of /t/c", () => {
    expect(at("/t/c/../admin?keep=1")).toBe("/");
    expect(at("/t/c/%2e%2e/admin?keep=1")).toBe("/");
  });

  test("outside /t/c → bare /", () => {
    expect(at("/pricing?keep=1")).toBe("/");
  });
});

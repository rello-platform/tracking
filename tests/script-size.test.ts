import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { SCRIPT_GZIP_LIMIT_BYTES, checkScriptSize } from "../src/index";

// `npm test` runs `npm run compile` first, so this reads the file just built from src/.
const built = readFileSync(new URL("../dist/script/s.js", import.meta.url));
const gz = (b: Buffer) => gzipSync(b, { level: 9 }).length;

describe("the page script size guard (plan §4: ≤ 3,584 B min+gz, KA ruling 1786 S12-SIZE-KA1786)", () => {
  test("the limit is 3,584 B (3.5 KB), measured minified + gzipped", () => {
    expect(SCRIPT_GZIP_LIMIT_BYTES).toBe(3584);
  });
  test("the built script is within the limit", () => {
    const r = checkScriptSize(gz(built));
    expect(r.ok, `dist/script/s.js is ${r.gzipBytes} B gzip, limit ${r.limit}`).toBe(true);
  });
  test("a script over 3.5 KB fails the size test", () => {
    // Incompressible padding so the gzip size really exceeds the limit.
    let seed = 1;
    const noise = Array.from({ length: 6000 }, () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), String.fromCharCode(33 + (seed % 90)))).join("");
    const over = Buffer.concat([built, Buffer.from(`/*${noise}*/`)]);
    expect(gz(over)).toBeGreaterThan(3584);
    expect(checkScriptSize(gz(over)).ok).toBe(false);
  });
  test("the built script has no runtime import and no zod", () => {
    const src = built.toString("utf8");
    expect(src).not.toMatch(/\bimport\s*[({"']|\brequire\(/);
    expect(src).not.toMatch(/zod/i);
    expect(src.startsWith("(()=>{") || src.startsWith('"use strict";(()=>{')).toBe(true);
  });
  test("it talks only to the same-origin intake", () => {
    const src = built.toString("utf8");
    expect(src).toContain('"/t/e"');
    expect(src).not.toMatch(/https?:\/\//);
  });
});

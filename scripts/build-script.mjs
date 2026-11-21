// Builds the page script (plan §4) to dist/script/s.js: one minified IIFE, no runtime
// imports. Run by `npm run compile` after tsc. The size limit is enforced by
// tests/script-size.test.ts on this exact file.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

const outfile = "dist/script/s.js";
await build({
  entryPoints: ["src/script/index.ts"],
  outfile,
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2019"],
  legalComments: "none",
  logLevel: "warning",
});
const raw = readFileSync(outfile);
console.error(`[build-script] ${outfile}: ${raw.length} B minified, ${gzipSync(raw, { level: 9 }).length} B gzip`);

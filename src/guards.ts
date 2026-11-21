/**
 * Package guards (plan §3.3 item 5). They walk a zod schema and report:
 * - every string with no upper bound (`.max()` / `.length()`, or a fixed-length format such as uuid or an ISO datetime);
 * - every object that is not `.strict()`.
 *
 * The package's own test runs both over all 12 event schemas and requires an empty
 * list, so adding an unbounded string field or a non-strict object fails the build.
 */
import type { z } from "zod";

const FIXED_FORMATS = new Set(["uuid", "guid", "datetime", "date", "time", "ipv4", "ipv6", "cuid", "cuid2", "ulid", "nanoid"]);

type Def = {
  type: string;
  checks?: Array<{ _zod: { def: { check: string; format?: string } } }>;
  format?: string;
  shape?: Record<string, z.ZodType>;
  catchall?: { _zod: { def: { type: string } } };
  innerType?: z.ZodType;
  options?: z.ZodType[];
  element?: z.ZodType;
  in?: z.ZodType;
  out?: z.ZodType;
};

const defOf = (s: z.ZodType): Def => (s as unknown as { _zod: { def: Def } })._zod.def;

function walk(s: z.ZodType, at: string, visit: (def: Def, at: string) => void): void {
  const def = defOf(s);
  visit(def, at);
  if (def.shape) for (const [k, v] of Object.entries(def.shape)) walk(v, at ? `${at}.${k}` : k, visit);
  if (def.innerType) walk(def.innerType, at, visit);
  if (def.options) def.options.forEach((o, i) => walk(o, `${at}|${i}`, visit));
  if (def.element) walk(def.element, `${at}[]`, visit);
  if (def.in) walk(def.in, at, visit);
  if (def.out) walk(def.out, at, visit);
}

/** Field paths of strings with no upper bound. */
export function findUnboundedStrings(schema: z.ZodType): string[] {
  const out: string[] = [];
  walk(schema, "", (def, at) => {
    if (def.type !== "string") return;
    if (def.format && FIXED_FORMATS.has(def.format)) return;
    const bounded = (def.checks ?? []).some((c) => c._zod.def.check === "max_length" || c._zod.def.check === "length_equals");
    if (!bounded) out.push(at || "(root)");
  });
  return out;
}

/** Field paths of objects that accept unknown keys. */
export function findNonStrictObjects(schema: z.ZodType): string[] {
  const out: string[] = [];
  walk(schema, "", (def, at) => {
    if (def.type === "object" && def.catchall?._zod.def.type !== "never") out.push(at || "(root)");
  });
  return out;
}

/** The script size limit (plan §4): ≤ 3 KB minified + gzipped. */
export const SCRIPT_GZIP_LIMIT_BYTES = 3072;

/** Pure check used by the size test; `gzipBytes` is the minified file's gzip size. */
export function checkScriptSize(gzipBytes: number, limit: number = SCRIPT_GZIP_LIMIT_BYTES): { ok: boolean; gzipBytes: number; limit: number } {
  return { ok: Number.isFinite(gzipBytes) && gzipBytes > 0 && gzipBytes <= limit, gzipBytes, limit };
}

/**
 * Package guards (plan §3.3 item 5). They walk a zod schema and report:
 * - every string with no upper bound (`.max()` / `.length()`, or a fixed-length format such as uuid or an ISO datetime);
 * - every object that is not `.strict()`.
 *
 * The package's own test runs both over all 12 event schemas and requires an empty
 * list, so adding an unbounded string field or a non-strict object fails the build.
 */
import type { z } from "zod";
/** Field paths of strings with no upper bound. */
export declare function findUnboundedStrings(schema: z.ZodType): string[];
/** Field paths of objects that accept unknown keys. */
export declare function findNonStrictObjects(schema: z.ZodType): string[];
/** The script size limit (plan §4): ≤ 3 KB minified + gzipped. */
export declare const SCRIPT_GZIP_LIMIT_BYTES = 3072;
/** Pure check used by the size test; `gzipBytes` is the minified file's gzip size. */
export declare function checkScriptSize(gzipBytes: number, limit?: number): {
    ok: boolean;
    gzipBytes: number;
    limit: number;
};
//# sourceMappingURL=guards.d.ts.map
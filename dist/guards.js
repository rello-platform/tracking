const FIXED_FORMATS = new Set(["uuid", "guid", "datetime", "date", "time", "ipv4", "ipv6", "cuid", "cuid2", "ulid", "nanoid"]);
const defOf = (s) => s._zod.def;
function walk(s, at, visit) {
    const def = defOf(s);
    visit(def, at);
    if (def.shape)
        for (const [k, v] of Object.entries(def.shape))
            walk(v, at ? `${at}.${k}` : k, visit);
    if (def.innerType)
        walk(def.innerType, at, visit);
    if (def.options)
        def.options.forEach((o, i) => walk(o, `${at}|${i}`, visit));
    if (def.element)
        walk(def.element, `${at}[]`, visit);
    if (def.in)
        walk(def.in, at, visit);
    if (def.out)
        walk(def.out, at, visit);
}
/** Field paths of strings with no upper bound. */
export function findUnboundedStrings(schema) {
    const out = [];
    walk(schema, "", (def, at) => {
        if (def.type !== "string")
            return;
        if (def.format && FIXED_FORMATS.has(def.format))
            return;
        const bounded = (def.checks ?? []).some((c) => c._zod.def.check === "max_length" || c._zod.def.check === "length_equals");
        if (!bounded)
            out.push(at || "(root)");
    });
    return out;
}
/** Field paths of objects that accept unknown keys. */
export function findNonStrictObjects(schema) {
    const out = [];
    walk(schema, "", (def, at) => {
        if (def.type === "object" && def.catchall?._zod.def.type !== "never")
            out.push(at || "(root)");
    });
    return out;
}
/** The script size limit (plan §4): ≤ 3 KB minified + gzipped. */
export const SCRIPT_GZIP_LIMIT_BYTES = 3072;
/** Pure check used by the size test; `gzipBytes` is the minified file's gzip size. */
export function checkScriptSize(gzipBytes, limit = SCRIPT_GZIP_LIMIT_BYTES) {
    return { ok: Number.isFinite(gzipBytes) && gzipBytes > 0 && gzipBytes <= limit, gzipBytes, limit };
}

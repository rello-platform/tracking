/**
 * The ads layer's package half (DESIGN-TRACKING-S12-ADS-LAYER-261122, S12b).
 *
 * - Constants the engine and the page script share: the four ad-click keys (§5.1), the loader's
 *   reasons (§3.1 Rev 3 item 2, Rev 4 item 1, Rev 5), the reviewed vendor list `ADS_VENDORS`
 *   (§3.1, starting empty), the `rtk_<letter>_` cookie letter set (§3.1 Rev 5 item 2), and the
 *   loader's one URL (§3.1 Rev 2 item 1).
 * - The two CLIENT events the page script sends and the edge transforms (they are not among the
 *   12 stored events): `landing.adclick` (§5.1 Rev 3, "the carrier") and `ads.decision`
 *   (§8 Rev 3 reach block). The design writes the event name as `type`; this package carries it in
 *   `name`, as every other event does. Each schema is `.strict()` with every string bounded
 *   (plan §3.3 item 5).
 * - `adClickParams`: the one reader of the four keys, used by the edge on `/t/c` and mirrored in
 *   the page script.
 *
 * What the engine decides (KV, cookies, the loader's per-request decision, storage) is not here.
 */
import { z } from "zod";
/** §5.1: the only query keys read for ad attribution. Every other key is never read. */
export const AD_CLICK_KEYS = ["gclid", "gbraid", "wbraid", "fbclid"];
/** §5.1: an ad-click value, 8 to 512 characters of `[A-Za-z0-9._-]`. */
export const AD_CLICK_VALUE = /^[A-Za-z0-9._-]{8,512}$/;
/**
 * What the loader decided for one page load, in the decision's precedence order. `served` is the
 * one answer that writes tags; every other is a no-tag answer whose reason is reported.
 * `gpc_client`, `no_decision_report` and `unknown_person` are reach labels the engine derives;
 * a loader never reports them.
 */
export const ADS_REASONS = [
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
];
/**
 * §3.1: the reviewed list of vendors a site's `others` may name, beyond the Meta Pixel and the
 * Google tag. It starts empty; adding a vendor is a package release, so no URL is typed into a form.
 */
export const ADS_VENDORS = [];
/** §3.1 Rev 5 item 2: the reference-cookie letters (`rtk_<letter>_<id>`): token, checkout, pending sign-in. */
export const RTK_LETTERS = ["t", "c", "p"];
/** Reserved for the tenant form join (scope T4); not written in S12. */
export const RTK_RESERVED_LETTERS = ["f"];
/** §3.1 Rev 2 item 1: the loader's one same-origin URL, no query string, never cached. */
export const ADS_LOADER_PATH = "/t/a.v1.js";
const PAGE_ID = z.string().max(64).regex(/^[A-Za-z0-9_-]{1,64}$/);
export const CLIENT_EVENT_NAMES = ["landing.adclick", "ads.decision"];
export const CLIENT_EVENT_SCHEMAS = {
    "landing.adclick": z
        .object({
        name: z.literal("landing.adclick"),
        pageId: PAGE_ID,
        params: z
            .array(z.object({ key: z.enum(AD_CLICK_KEYS), value: z.string().max(512).regex(AD_CLICK_VALUE) }).strict())
            .min(1)
            .max(AD_CLICK_KEYS.length)
            .refine((ps) => new Set(ps.map((p) => p.key)).size === ps.length, { message: "keys must be unique" }),
    })
        .strict(),
    "ads.decision": z.object({ name: z.literal("ads.decision"), pageId: PAGE_ID, reason: z.enum(ADS_REASONS) }).strict(),
};
/** Validate one client event by its `name`. Unknown names are refused. */
export function parseClientEvent(input) {
    if (typeof input !== "object" || input === null)
        return { ok: false, error: "event is not an object" };
    const name = input.name;
    if (typeof name !== "string" || !CLIENT_EVENT_NAMES.includes(name))
        return { ok: false, error: "unknown client event name" };
    const r = CLIENT_EVENT_SCHEMAS[name].safeParse(input);
    return r.success ? { ok: true, event: r.data } : { ok: false, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
}
/**
 * The ad-click params of a query: the four keys only, in key order, the first value of each.
 * A missing, malformed or over-long value drops that key alone. Never throws.
 */
export function adClickParams(query) {
    try {
        const q = typeof query === "string" ? new URLSearchParams(query) : query;
        const out = [];
        for (const key of AD_CLICK_KEYS) {
            const value = q.get(key);
            if (value !== null && AD_CLICK_VALUE.test(value))
                out.push({ key, value });
        }
        return out;
    }
    catch {
        return [];
    }
}

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
export declare const AD_CLICK_KEYS: readonly ["gclid", "gbraid", "wbraid", "fbclid"];
export type AdClickKey = (typeof AD_CLICK_KEYS)[number];
/** §5.1: an ad-click value, 8 to 512 characters of `[A-Za-z0-9._-]`. */
export declare const AD_CLICK_VALUE: RegExp;
/**
 * What the loader decided for one page load, in the decision's precedence order. `served` is the
 * one answer that writes tags; every other is a no-tag answer whose reason is reported.
 * `gpc_client`, `no_decision_report` and `unknown_person` are reach labels the engine derives;
 * a loader never reports them.
 */
export declare const ADS_REASONS: readonly ["served", "switch_off", "host_owner_changed", "region_no_consent_ui", "gpc_header", "opted_out", "optout_unknown", "identity_overflow", "pending_identity", "consent_refresh"];
export type AdsReason = (typeof ADS_REASONS)[number];
/**
 * §3.1: the reviewed list of vendors a site's `others` may name, beyond the Meta Pixel and the
 * Google tag. It starts empty; adding a vendor is a package release, so no URL is typed into a form.
 */
export declare const ADS_VENDORS: readonly string[];
/** §3.1 Rev 5 item 2: the reference-cookie letters (`rtk_<letter>_<id>`): token, checkout, pending sign-in. */
export declare const RTK_LETTERS: readonly ["t", "c", "p"];
/** Reserved for the tenant form join (scope T4); not written in S12. */
export declare const RTK_RESERVED_LETTERS: readonly ["f"];
/** §3.1 Rev 2 item 1: the loader's one same-origin URL, no query string, never cached. */
export declare const ADS_LOADER_PATH = "/t/a.v1.js";
export declare const CLIENT_EVENT_NAMES: readonly ["landing.adclick", "ads.decision"];
export type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];
export declare const CLIENT_EVENT_SCHEMAS: {
    readonly "landing.adclick": z.ZodObject<{
        name: z.ZodLiteral<"landing.adclick">;
        pageId: z.ZodString;
        params: z.ZodArray<z.ZodObject<{
            key: z.ZodEnum<{
                gclid: "gclid";
                gbraid: "gbraid";
                wbraid: "wbraid";
                fbclid: "fbclid";
            }>;
            value: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    readonly "ads.decision": z.ZodObject<{
        name: z.ZodLiteral<"ads.decision">;
        pageId: z.ZodString;
        reason: z.ZodEnum<{
            served: "served";
            switch_off: "switch_off";
            host_owner_changed: "host_owner_changed";
            region_no_consent_ui: "region_no_consent_ui";
            gpc_header: "gpc_header";
            opted_out: "opted_out";
            optout_unknown: "optout_unknown";
            identity_overflow: "identity_overflow";
            pending_identity: "pending_identity";
            consent_refresh: "consent_refresh";
        }>;
    }, z.core.$strict>;
};
export type ClientEvent = {
    [N in ClientEventName]: z.infer<(typeof CLIENT_EVENT_SCHEMAS)[N]>;
}[ClientEventName];
/** Validate one client event by its `name`. Unknown names are refused. */
export declare function parseClientEvent(input: unknown): {
    ok: true;
    event: ClientEvent;
} | {
    ok: false;
    error: string;
};
/**
 * The ad-click params of a query: the four keys only, in key order, the first value of each.
 * A missing, malformed or over-long value drops that key alone. Never throws.
 */
export declare function adClickParams(query: string | URLSearchParams): Array<{
    key: AdClickKey;
    value: string;
}>;
//# sourceMappingURL=ads.d.ts.map
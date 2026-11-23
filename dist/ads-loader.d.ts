/**
 * The body of `/t/a.v1.js` (DESIGN-TRACKING-S12-ADS-LAYER §3.1, §3.2, §3.5, §8 Rev 3 reach block).
 *
 * The engine decides per request WHETHER a page gets tags (switch, host owner, region, GPC header,
 * opt-out, identity, consent: the engine half). This module is WHAT it serves, so the bytes are
 * reviewed and size-tested in the package (§3.5: ≤ 2 KB gzip):
 * - `adsNoTagScript(reason)`: the no-tag answer, `window.__rt&&__rt.ads("<reason>")`, so every
 *   miss is reported back by the page script as `ads.decision` (§8 Rev 3).
 * - `adsLoaderScript({ metaPixelId?, googleTagId? })`: the served answer. It reports `served` first,
 *   then writes the Google tag with consent mode's default set BEFORE `config` (§3.2), and the
 *   Meta Pixel, each firing PageView only. A browser reporting GPC (a `Sec-GPC` header stripped on
 *   the way) gets all four Google consent types denied and no Meta Pixel (§3.2 Rev 2).
 *
 * Every id is checked against its vendor's shape before it is written into the script, so a
 * config value can never become code. A bad id or reason throws a RangeError: the caller (the
 * engine) then serves a no-tag answer, never a broken script. The script itself never throws
 * into the page.
 */
import { type AdsReason } from "./ads.js";
/** §3.5: the loader's own size limit, minified + gzipped. */
export declare const ADS_LOADER_GZIP_LIMIT_BYTES = 2048;
/** The vendor hosts the loader may write. The page script must carry none of them (§3.5). */
export declare const ADS_VENDOR_HOSTNAMES: readonly ["connect.facebook.net", "www.googletagmanager.com", "www.google-analytics.com", "googleads.g.doubleclick.net", "www.googleadservices.com"];
/** The no-tag answer for `reason` (never `served`: a no-tag answer that said "served" would count a miss as reach). */
export declare function adsNoTagScript(reason: Exclude<AdsReason, "served">): string;
/** The served loader for one host's config. At least one vendor id is required. */
export declare function adsLoaderScript(cfg: {
    metaPixelId?: string;
    googleTagId?: string;
}): string;
//# sourceMappingURL=ads-loader.d.ts.map
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
import { ADS_REASONS, type AdsReason } from "./ads.js";

/** §3.5: the loader's own size limit, minified + gzipped. */
export const ADS_LOADER_GZIP_LIMIT_BYTES = 2048;

/** The vendor hosts the loader may write. The page script must carry none of them (§3.5). */
export const ADS_VENDOR_HOSTNAMES = ["connect.facebook.net", "www.googletagmanager.com", "www.google-analytics.com", "googleads.g.doubleclick.net", "www.googleadservices.com"] as const;

const META_PIXEL_ID = /^[0-9]{5,20}$/;
const GOOGLE_TAG_ID = /^(?:G|AW|GT|DC)-[A-Z0-9]{4,20}$/;

/** The no-tag answer for `reason` (never `served`: a no-tag answer that said "served" would count a miss as reach). */
export function adsNoTagScript(reason: Exclude<AdsReason, "served">): string {
  if (reason === ("served" as string) || !(ADS_REASONS as readonly string[]).includes(reason)) throw new RangeError("adsNoTagScript: not a no-tag reason");
  return `window.__rt&&__rt.ads("${reason}")`;
}

/** The served loader for one host's config. At least one vendor id is required. */
export function adsLoaderScript(cfg: { metaPixelId?: string; googleTagId?: string }): string {
  const { metaPixelId: meta, googleTagId: google } = cfg ?? {};
  if (meta === undefined && google === undefined) throw new RangeError("adsLoaderScript: no vendor configured");
  if (meta !== undefined && !META_PIXEL_ID.test(meta)) throw new RangeError("adsLoaderScript: metaPixelId is not a Meta Pixel id");
  if (google !== undefined && !GOOGLE_TAG_ID.test(google)) throw new RangeError("adsLoaderScript: googleTagId is not a Google tag id");
  const s = (src: string) => `var s=d.createElement("script");s.async=!0;s.src="${src}";d.head.appendChild(s);`;
  const g = google
    ? `w.dataLayer=w.dataLayer||[];var gt=w.gtag=w.gtag||function(){w.dataLayer.push(arguments)};var c=gpc?"denied":"granted";` +
      `gt("consent","default",{ad_storage:c,analytics_storage:c,ad_user_data:c,ad_personalization:c});gt("js",new Date);gt("config","${google}");` +
      s(`https://www.googletagmanager.com/gtag/js?id=${google}`)
    : "";
  const m = meta
    ? `if(!gpc){if(!w.fbq){var n=w.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!w._fbq)w._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];` +
      s("https://connect.facebook.net/en_US/fbevents.js") +
      `}w.fbq("init","${meta}");w.fbq("track","PageView")}`
    : "";
  return `(function(w,d){try{var gpc=!!(w.navigator&&w.navigator.globalPrivacyControl===true);w.__rt&&w.__rt.ads("served");${g}${m}}catch(e){}})(window,document);`;
}

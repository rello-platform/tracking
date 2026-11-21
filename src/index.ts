/**
 * @rello-platform/tracking — the platform tracking vocabulary (PLATFORM-TRACKING-SYSTEM S1).
 *
 * - `EVENT_NAMES`, `EVENT_SCHEMAS`, `parseEvent`: the 12 stored events, each `.strict()` (plan §3).
 * - `FEATURES`, `ROUTES`, `matchRoute`: the reviewed per-app registries (§3.1–§3.3).
 * - `findUnboundedStrings`, `findNonStrictObjects`, `checkScriptSize`: the package guards (§3.3, §4).
 * - `@rello-platform/tracking/redirect`: the pure `/t/c` redirect (§2.4).
 * - `@rello-platform/tracking/script`: the built page script (§4).
 */
export * from "./schemas.js";
export * from "./registry.js";
export * from "./guards.js";

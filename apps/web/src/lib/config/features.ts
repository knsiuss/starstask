export type FeatureFlag = "ocr" | "calendarSync" | "sessionCheckIn";

/**
 * Module switches for optional surfaces. Every flag defaults to on so a
 * deployment that never sets them behaves exactly as before. Only an explicit
 * false value turns a module off; a typo must not silently hide a feature.
 *
 * These are build-time public values (`NEXT_PUBLIC_*`). They control visibility
 * and route availability, not authorization: every route still verifies the
 * session and its own permissions.
 */
const DISABLED_VALUES = new Set(["0", "false", "off", "no", "disabled"]);

export function parseFeatureFlag(raw: string | undefined): boolean {
  if (raw === undefined) {
    return true;
  }

  return !DISABLED_VALUES.has(raw.trim().toLowerCase());
}

const FLAGS: Record<FeatureFlag, boolean> = {
  ocr: parseFeatureFlag(process.env.NEXT_PUBLIC_FEATURE_OCR),
  calendarSync: parseFeatureFlag(process.env.NEXT_PUBLIC_FEATURE_CALENDAR_SYNC),
  sessionCheckIn: parseFeatureFlag(
    process.env.NEXT_PUBLIC_FEATURE_SESSION_CHECKIN,
  ),
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag];
}

export const DEFAULT_ATTENDANCE_RETENTION_DAYS = 30;
export const MAX_ATTENDANCE_RETENTION_DAYS = 3650;

/**
 * Reads the deployment's coordinate retention window. An unset or malformed
 * value falls back to 30 days rather than disabling the purge, because keeping
 * coordinates forever is the outcome that needs a deliberate choice.
 */
export function resolveAttendanceRetentionDays(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = env.ATTENDANCE_RETENTION_DAYS?.trim();

  if (!raw) {
    return DEFAULT_ATTENDANCE_RETENTION_DAYS;
  }

  const days = Number(raw);

  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > MAX_ATTENDANCE_RETENTION_DAYS
  ) {
    return DEFAULT_ATTENDANCE_RETENTION_DAYS;
  }

  return days;
}

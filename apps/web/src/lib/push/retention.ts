export const DEFAULT_NOTIFICATION_RETENTION_DAYS = 180;
export const MAX_NOTIFICATION_RETENTION_DAYS = 3650;

/**
 * Reads the deployment's reminder-ledger retention window. An unset or malformed
 * value falls back to 180 days rather than disabling the purge, because keeping
 * the ledger forever is the outcome that needs a deliberate choice.
 */
export function resolveNotificationRetentionDays(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = env.NOTIFICATION_RETENTION_DAYS?.trim();

  if (!raw) {
    return DEFAULT_NOTIFICATION_RETENTION_DAYS;
  }

  const days = Number(raw);

  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > MAX_NOTIFICATION_RETENTION_DAYS
  ) {
    return DEFAULT_NOTIFICATION_RETENTION_DAYS;
  }

  return days;
}

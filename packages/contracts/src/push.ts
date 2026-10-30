import { z } from "zod";

export const PUSH_REMINDER_TYPES = ["24h", "3h"] as const;

export type PushReminderType = (typeof PUSH_REMINDER_TYPES)[number];

/** Reminder offsets in milliseconds; the scheduler subtracts these from a deadline. */
export const PUSH_REMINDER_OFFSET_MS: Record<PushReminderType, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "3h": 3 * 60 * 60 * 1000,
};

export const DEFAULT_NOTIFICATION_TIMEZONE = "Asia/Jakarta";

/** Time zones offered in the settings UI; any valid IANA zone is accepted. */
export const COMMON_NOTIFICATION_TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "UTC",
] as const;

/** True when `value` is a time zone the runtime's Intl implementation knows. */
export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });

    return true;
  } catch {
    return false;
  }
}

export const timeZoneSchema = z
  .string()
  .trim()
  .min(1, "A time zone is required")
  .max(64, "Time zone must be 64 characters or fewer")
  .refine(
    isValidTimeZone,
    "Use a valid IANA time zone, for example Asia/Jakarta",
  );

/**
 * Push services always live on HTTPS port 443 with a DNS hostname. Rejecting
 * everything else keeps the server from being pointed at an internal address
 * when it later POSTs to the stored endpoint.
 */
export function isAcceptablePushEndpoint(value: string): boolean {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") {
    return false;
  }

  if (url.port !== "" && url.port !== "443") {
    return false;
  }

  if (url.username || url.password) {
    return false;
  }

  const host = url.hostname.toLowerCase();

  if (!host || host === "localhost" || host.endsWith(".localhost")) {
    return false;
  }

  // Any IP literal (v4 or v6) is rejected: push endpoints are always named.
  if (
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
    host.includes(":") ||
    host.includes("[")
  ) {
    return false;
  }

  return true;
}

const base64UrlKey = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} is too short`)
    .max(max, `${label} is too long`)
    .regex(/^[A-Za-z0-9_-]+={0,2}$/, `${label} must be base64url encoded`);

export const pushEndpointSchema = z
  .string()
  .trim()
  .max(2048, "Endpoint is too long")
  .refine(isAcceptablePushEndpoint, "That push endpoint is not supported");

export const pushSubscriptionSchema = z
  .object({
    endpoint: pushEndpointSchema,
    keys: z.object({
      p256dh: base64UrlKey(16, 200, "The p256dh key"),
      auth: base64UrlKey(8, 100, "The auth secret"),
    }),
    deviceLabel: z
      .string()
      .trim()
      .max(60, "Device name must be 60 characters or fewer")
      .optional()
      .transform((value) => (value === "" ? undefined : value)),
  })
  .strict();

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/** Body for removing the current browser's subscription by endpoint. */
export const pushUnsubscribeSchema = z
  .object({ endpoint: pushEndpointSchema })
  .strict();

export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;

export const notificationPreferencesSchema = z
  .object({
    pushEnabled: z.boolean().optional(),
    reminder24h: z.boolean().optional(),
    reminder3h: z.boolean().optional(),
    /** Discussion session reminders are configured independently of deadlines. */
    sessionReminder24h: z.boolean().optional(),
    sessionReminder3h: z.boolean().optional(),
    timezone: timeZoneSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export type NotificationPreferencesInput = z.infer<
  typeof notificationPreferencesSchema
>;

export const savedAssignmentSchema = z
  .object({
    assignmentId: z.uuid("Invalid assignment id"),
  })
  .strict();

export type SavedAssignmentInput = z.infer<typeof savedAssignmentSchema>;

/**
 * The sanitized payload stored on a notification event.
 *
 * Database functions build only these fields, so parsing keeps a malformed or
 * unexpected row from rendering as an in-app notification.
 */
export const notificationEventPayloadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(500),
  url: z.string().trim().max(2048),
});

export type NotificationEventPayload = z.infer<
  typeof notificationEventPayloadSchema
>;

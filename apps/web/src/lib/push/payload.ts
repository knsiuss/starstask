import {
  assignmentIdSchema,
  type PushReminderType,
} from "@starstask/contracts";
import { formatDeadlineInTimeZone } from "@starstask/shared";

export const NOTIFICATION_ICON = "/icons/icon-192.png";
export const NOTIFICATION_BADGE = "/icons/badge-96.png";

export type ReminderPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  icon: string;
  badge: string;
  timestamp: number;
};

export type ReminderPayloadInput = {
  assignmentId: string;
  courseName: string;
  deadline: string;
  reminderType: PushReminderType;
  timezone: string;
  nowMs: number;
};

/**
 * Builds the JSON payload handed to `web-push`.
 *
 * Only the assignment id, course name, deadline, and a reminder type go into
 * the payload. No owner id, email, or storage path is included, and the URL is
 * always an internal path derived from a validated UUID.
 *
 * @returns `null` when the assignment id or deadline cannot be trusted; the
 * scheduler then records the delivery as skipped instead of sending.
 */
export function buildReminderPayload(
  input: ReminderPayloadInput,
): ReminderPayload | null {
  if (!assignmentIdSchema.safeParse(input.assignmentId).success) {
    return null;
  }

  const deadlineMs = Date.parse(input.deadline);

  if (!Number.isFinite(deadlineMs)) {
    return null;
  }

  const hoursLeft = Math.max(
    1,
    Math.round((deadlineMs - input.nowMs) / 3_600_000),
  );
  const course = truncate(input.courseName.trim(), 60) || "Your course";
  const deadlineLabel = formatDeadlineInTimeZone(
    input.deadline,
    input.timezone,
  );

  return {
    title:
      input.reminderType === "24h"
        ? "StarsTask: Deadline tomorrow"
        : "StarsTask: Deadline in a few hours",
    body: `Your ${course} assignment is due in ${hoursLeft} ${
      hoursLeft === 1 ? "hour" : "hours"
    } — ${deadlineLabel}.`,
    url: `/assignments/${input.assignmentId}`,
    tag: `starstask:${input.assignmentId}:${input.reminderType}:${input.deadline}`,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    timestamp: input.nowMs,
  };
}

/** In-app pages a push notification may open. No external origin is allowed. */
const STATIC_SAFE_PATHS = new Set([
  "/dashboard",
  "/dashboard/review",
  "/my-assignments",
  "/sessions",
  "/settings/calendar",
  "/settings/profile",
  "/admin/verifications",
]);

const CLASS_PATH_PATTERN = /^\/classes\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SESSION_PATH_PATTERN =
  /^\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Notification clicks may only open an internal app path: a published
 * assignment detail, a class page, or one of the signed-in dashboards.
 * The service worker repeats this check because a payload is untrusted input
 * by the time it reaches the browser.
 */
export function isSafeNotificationPath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return false;
  }

  if (
    STATIC_SAFE_PATHS.has(value) ||
    CLASS_PATH_PATTERN.test(value) ||
    SESSION_PATH_PATTERN.test(value)
  ) {
    return true;
  }

  const prefix = "/assignments/";

  if (!value.startsWith(prefix)) {
    return false;
  }

  return assignmentIdSchema.safeParse(value.slice(prefix.length)).success;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1)}…`;
}

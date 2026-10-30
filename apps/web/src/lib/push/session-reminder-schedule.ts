import {
  PUSH_REMINDER_OFFSET_MS,
  PUSH_REMINDER_TYPES,
  type PushReminderType,
} from "@starstask/contracts";
import { formatSessionRange } from "@starstask/shared";

import {
  NOTIFICATION_BADGE,
  NOTIFICATION_ICON,
  type ReminderPayload,
} from "@/lib/push/payload";
import {
  MAX_DELIVERY_ATTEMPTS,
  REMINDER_GRACE_MS,
} from "@/lib/push/reminder-schedule";
import type { SessionReminderClaim } from "@/types/database";

export { MAX_DELIVERY_ATTEMPTS };

/** 25 hours: one hour wider than the longest reminder offset. */
export const SESSION_REMINDER_HORIZON_MS = 25 * 60 * 60 * 1000;

export type SessionReminderPlan = {
  reminderType: PushReminderType;
  startsAt: string;
  scheduledFor: string;
};

/**
 * Plans the reminders for one session start.
 *
 * Pure and clock-injected so the time zone rules can be tested without a
 * database: `starts_at` is an absolute instant, and the configured zone is only
 * used to phrase the message.
 */
export function planSessionReminders(
  startsAtIso: string | null | undefined,
  nowMs: number,
): SessionReminderPlan[] {
  if (!startsAtIso) {
    return [];
  }

  const startsAt = Date.parse(startsAtIso);

  if (!Number.isFinite(startsAt) || startsAt <= nowMs) {
    return [];
  }

  const plans: SessionReminderPlan[] = [];

  for (const reminderType of PUSH_REMINDER_TYPES) {
    const scheduled = startsAt - PUSH_REMINDER_OFFSET_MS[reminderType];

    if (scheduled > nowMs || scheduled <= nowMs - REMINDER_GRACE_MS) {
      continue;
    }

    plans.push({
      reminderType,
      startsAt: new Date(startsAt).toISOString(),
      scheduledFor: new Date(scheduled).toISOString(),
    });
  }

  return plans;
}

export type SessionReminderDecision =
  { kind: "skip"; reason: string } | { kind: "send"; payload: ReminderPayload };

export type SessionReminderPayloadInput = {
  sessionId: string;
  title: string;
  className: string;
  startsAt: string;
  endsAt: string;
  /** The reader's zone; the session zone is only the fallback. */
  timezone: string;
  reminderType: PushReminderType;
  nowMs: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Builds the push payload; `null` when the row cannot be trusted. */
export function buildSessionReminderPayload(
  input: SessionReminderPayloadInput,
): ReminderPayload | null {
  if (!UUID_PATTERN.test(input.sessionId)) {
    return null;
  }

  const startsAt = Date.parse(input.startsAt);

  if (!Number.isFinite(startsAt)) {
    return null;
  }

  const hoursLeft = Math.max(
    1,
    Math.round((startsAt - input.nowMs) / 3_600_000),
  );
  const className = truncate(input.className.trim(), 60) || "Your class";
  const title = truncate(input.title.trim(), 80) || "Discussion session";
  const when = formatSessionRange(input.startsAt, input.endsAt, input.timezone);

  return {
    title:
      input.reminderType === "24h"
        ? "StarsTask: Session tomorrow"
        : "StarsTask: Session in a few hours",
    body: `${className} — ${title} starts in ${hoursLeft} ${
      hoursLeft === 1 ? "hour" : "hours"
    } (${when}).`,
    url: `/sessions/${input.sessionId}`,
    tag: `starstask:session:${input.sessionId}:${input.reminderType}:${input.startsAt}`,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    timestamp: input.nowMs,
  };
}

/**
 * Re-validates a claimed reminder right before sending.
 *
 * The claim query joined the session and the preferences, but both may have
 * changed since enqueue. A cancelled session, a moved start time, or a disabled
 * reminder must never produce a notification.
 */
export function evaluateSessionReminder(
  claim: SessionReminderClaim,
  nowMs: number,
): SessionReminderDecision {
  if (claim.session_status !== "scheduled") {
    return { kind: "skip", reason: "session_not_scheduled" };
  }

  if (Date.parse(claim.current_starts_at) !== Date.parse(claim.starts_at)) {
    return { kind: "skip", reason: "schedule_changed" };
  }

  if (claim.push_enabled === false) {
    return { kind: "skip", reason: "push_disabled" };
  }

  const enabled =
    claim.reminder_type === "24h" ? claim.reminder_24h : claim.reminder_3h;

  if (enabled === false) {
    return { kind: "skip", reason: "reminder_disabled" };
  }

  const payload = buildSessionReminderPayload({
    sessionId: claim.session_id,
    title: claim.session_title,
    className: claim.class_name,
    startsAt: claim.starts_at,
    endsAt: claim.session_ends_at,
    reminderType: claim.reminder_type,
    timezone: claim.pref_timezone ?? claim.session_time_zone,
    nowMs,
  });

  if (!payload) {
    return { kind: "skip", reason: "invalid_payload" };
  }

  return { kind: "send", payload };
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1)}…`;
}

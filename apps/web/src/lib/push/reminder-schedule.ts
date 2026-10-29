import {
  PUSH_REMINDER_OFFSET_MS,
  PUSH_REMINDER_TYPES,
  type PushReminderType,
} from "@starstask/contracts";

/**
 * A reminder is still worth sending for one hour after its scheduled instant.
 * The cron runs every ten minutes, so this only covers a missed or slow run —
 * it never turns a "24 hours left" reminder into a "2 hours left" one.
 */
export const REMINDER_GRACE_MS = 60 * 60 * 1000;

/** Look-ahead used when loading candidate assignments (25h > the 24h offset). */
export const REMINDER_HORIZON_MS = 25 * 60 * 60 * 1000;

export const MAX_DELIVERY_ATTEMPTS = 3;

/** Backoff before a transient failure is retried, indexed by attempt count. */
const RETRY_DELAYS_MS = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];

export type ReminderPlan = {
  reminderType: PushReminderType;
  deadlineAt: string;
  scheduledFor: string;
};

/**
 * Plans the reminders that should be enqueued for one deadline at `nowMs`.
 *
 * Returns an empty list when the deadline is missing, unparseable, already
 * past, or outside both reminder windows. Pure so tests can pin the clock.
 */
export function planReminders(
  deadlineIso: string | null | undefined,
  nowMs: number,
): ReminderPlan[] {
  if (!deadlineIso) {
    return [];
  }

  const deadline = Date.parse(deadlineIso);

  if (!Number.isFinite(deadline) || deadline <= nowMs) {
    return [];
  }

  const plans: ReminderPlan[] = [];

  for (const reminderType of PUSH_REMINDER_TYPES) {
    const scheduled = deadline - PUSH_REMINDER_OFFSET_MS[reminderType];

    if (scheduled > nowMs || scheduled <= nowMs - REMINDER_GRACE_MS) {
      continue;
    }

    plans.push({
      reminderType,
      deadlineAt: new Date(deadline).toISOString(),
      scheduledFor: new Date(scheduled).toISOString(),
    });
  }

  return plans;
}

/** Earliest time a failed delivery may be retried. */
export function nextAttemptAt(attemptCount: number, nowMs: number): string {
  const index = Math.min(
    Math.max(attemptCount - 1, 0),
    RETRY_DELAYS_MS.length - 1,
  );
  const delay = RETRY_DELAYS_MS[index] ?? 60 * 60 * 1000;

  return new Date(nowMs + delay).toISOString();
}

export function isReminderTypeEnabled(
  reminderType: PushReminderType,
  preferences: { reminder24h: boolean; reminder3h: boolean },
): boolean {
  return reminderType === "24h"
    ? preferences.reminder24h
    : preferences.reminder3h;
}

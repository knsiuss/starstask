import { describe, expect, it } from "vitest";

import {
  isReminderTypeEnabled,
  MAX_DELIVERY_ATTEMPTS,
  nextAttemptAt,
  planReminders,
  REMINDER_GRACE_MS,
  REMINDER_HORIZON_MS,
} from "@/lib/push/reminder-schedule";

const NOW_MS = Date.parse("2026-10-29T03:00:00.000Z");
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function isoAt(offsetMs: number): string {
  return new Date(NOW_MS + offsetMs).toISOString();
}

describe("reminder constants", () => {
  it("keeps the grace period shorter than the cron interval's worth of slack", () => {
    expect(REMINDER_GRACE_MS).toBe(HOUR_MS);
  });

  it("looks ahead far enough to catch the 24-hour window", () => {
    expect(REMINDER_HORIZON_MS).toBeGreaterThan(24 * HOUR_MS);
  });

  it("bounds retries", () => {
    expect(MAX_DELIVERY_ATTEMPTS).toBe(3);
  });
});

describe("planReminders", () => {
  it("plans the 24-hour reminder when the deadline is exactly 24 hours away", () => {
    const deadline = isoAt(24 * HOUR_MS);

    expect(planReminders(deadline, NOW_MS)).toEqual([
      { reminderType: "24h", deadlineAt: deadline, scheduledFor: isoAt(0) },
    ]);
  });

  it("plans the three-hour reminder when the deadline is three hours away", () => {
    const deadline = isoAt(3 * HOUR_MS);

    expect(planReminders(deadline, NOW_MS)).toEqual([
      { reminderType: "3h", deadlineAt: deadline, scheduledFor: isoAt(0) },
    ]);
  });

  it("still plans a reminder that became due within the grace period", () => {
    const deadline = isoAt(23 * HOUR_MS + 30 * MINUTE_MS);

    expect(planReminders(deadline, NOW_MS)).toEqual([
      {
        reminderType: "24h",
        deadlineAt: deadline,
        scheduledFor: isoAt(-30 * MINUTE_MS),
      },
    ]);
  });

  it("does not plan a reminder that is still in the future", () => {
    expect(planReminders(isoAt(24 * HOUR_MS + 30 * MINUTE_MS), NOW_MS)).toEqual(
      [],
    );
  });

  it("drops a reminder older than the grace period", () => {
    expect(planReminders(isoAt(22 * HOUR_MS), NOW_MS)).toEqual([]);
  });

  it("drops a three-hour reminder that is exactly one grace period late", () => {
    expect(planReminders(isoAt(2 * HOUR_MS), NOW_MS)).toEqual([]);
  });

  it("keeps a three-hour reminder that is slightly late", () => {
    const deadline = isoAt(2 * HOUR_MS + 30 * MINUTE_MS);

    expect(planReminders(deadline, NOW_MS)).toEqual([
      {
        reminderType: "3h",
        deadlineAt: deadline,
        scheduledFor: isoAt(-30 * MINUTE_MS),
      },
    ]);
  });

  it("plans nothing for a deadline beyond the horizon", () => {
    expect(planReminders(isoAt(48 * HOUR_MS), NOW_MS)).toEqual([]);
  });

  it("plans nothing for a deadline that has already passed", () => {
    expect(planReminders(isoAt(-MINUTE_MS), NOW_MS)).toEqual([]);
    expect(planReminders(isoAt(0), NOW_MS)).toEqual([]);
  });

  it("plans nothing for a missing or unparseable deadline", () => {
    expect(planReminders(null, NOW_MS)).toEqual([]);
    expect(planReminders(undefined, NOW_MS)).toEqual([]);
    expect(planReminders("not-a-date", NOW_MS)).toEqual([]);
  });
});

describe("nextAttemptAt", () => {
  it.each([
    { attempts: 0, minutes: 5 },
    { attempts: 1, minutes: 5 },
    { attempts: 2, minutes: 15 },
    { attempts: 3, minutes: 60 },
    { attempts: 9, minutes: 60 },
  ])(
    "waits $minutes minutes after attempt $attempts",
    ({ attempts, minutes }) => {
      expect(nextAttemptAt(attempts, NOW_MS)).toBe(isoAt(minutes * MINUTE_MS));
    },
  );
});

describe("isReminderTypeEnabled", () => {
  it("maps each reminder type to its own preference", () => {
    expect(
      isReminderTypeEnabled("24h", { reminder24h: true, reminder3h: false }),
    ).toBe(true);
    expect(
      isReminderTypeEnabled("24h", { reminder24h: false, reminder3h: true }),
    ).toBe(false);
    expect(
      isReminderTypeEnabled("3h", { reminder24h: false, reminder3h: true }),
    ).toBe(true);
    expect(
      isReminderTypeEnabled("3h", { reminder24h: true, reminder3h: false }),
    ).toBe(false);
  });
});

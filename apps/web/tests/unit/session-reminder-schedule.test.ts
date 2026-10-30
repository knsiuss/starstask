import { describe, expect, it } from "vitest";

import {
  buildSessionReminderPayload,
  evaluateSessionReminder,
  planSessionReminders,
  SESSION_REMINDER_HORIZON_MS,
} from "@/lib/push/session-reminder-schedule";
import type { SessionReminderClaim } from "@/types/database";

const NOW_MS = Date.parse("2026-11-04T12:00:00.000Z");
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const SESSION_ID = "3f2b6c1e-8a4d-4f6b-9c2e-1d5a7b9c0e3f";

function isoAt(offsetMs: number): string {
  return new Date(NOW_MS + offsetMs).toISOString();
}

function claim(
  overrides: Partial<SessionReminderClaim> = {},
): SessionReminderClaim {
  return {
    id: "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
    user_id: "11111111-2222-3333-4444-555555555555",
    session_id: SESSION_ID,
    reminder_type: "24h",
    starts_at: isoAt(24 * HOUR_MS),
    attempt_count: 0,
    session_title: "Midterm review",
    session_status: "scheduled",
    session_time_zone: "Asia/Jakarta",
    session_ends_at: isoAt(26 * HOUR_MS),
    current_starts_at: isoAt(24 * HOUR_MS),
    class_name: "Algorithms",
    push_enabled: true,
    reminder_24h: true,
    reminder_3h: true,
    pref_timezone: "Asia/Jakarta",
    ...overrides,
  };
}

describe("planSessionReminders", () => {
  it("looks slightly further ahead than the longest offset", () => {
    expect(SESSION_REMINDER_HORIZON_MS).toBe(25 * HOUR_MS);
  });

  it("plans the 24-hour reminder when it is due now", () => {
    const startsAt = isoAt(24 * HOUR_MS);

    expect(planSessionReminders(startsAt, NOW_MS)).toEqual([
      { reminderType: "24h", startsAt, scheduledFor: isoAt(0) },
    ]);
  });

  it("plans the 3-hour reminder when it is due now", () => {
    const startsAt = isoAt(3 * HOUR_MS);

    expect(planSessionReminders(startsAt, NOW_MS)).toEqual([
      { reminderType: "3h", startsAt, scheduledFor: isoAt(0) },
    ]);
  });

  it("plans nothing for a session that is still a week away", () => {
    expect(planSessionReminders(isoAt(7 * 24 * HOUR_MS), NOW_MS)).toEqual([]);
  });

  it("still fires a reminder that became due inside the grace window", () => {
    // The 24-hour reminder was due 20 minutes ago, which is inside the one-hour
    // grace window, so it is still worth sending.
    const startsAt = isoAt(24 * HOUR_MS - 20 * MINUTE_MS);

    expect(planSessionReminders(startsAt, NOW_MS)).toEqual([
      {
        reminderType: "24h",
        startsAt,
        scheduledFor: isoAt(-20 * MINUTE_MS),
      },
    ]);
  });

  it("does not fire a reminder whose window has not opened yet", () => {
    // The 24-hour reminder is due in 20 minutes, so this run must not send it.
    expect(
      planSessionReminders(isoAt(24 * HOUR_MS + 20 * MINUTE_MS), NOW_MS),
    ).toEqual([]);
  });

  it("drops a reminder that is older than the grace window", () => {
    // The 3-hour reminder for a session starting in 30 minutes was due 2.5
    // hours ago, so sending it now would be noise.
    expect(planSessionReminders(isoAt(30 * MINUTE_MS), NOW_MS)).toEqual([]);
  });

  it("plans nothing for a session that already started", () => {
    expect(planSessionReminders(isoAt(-HOUR_MS), NOW_MS)).toEqual([]);
  });

  it("plans nothing for a missing or invalid start", () => {
    expect(planSessionReminders(null, NOW_MS)).toEqual([]);
    expect(planSessionReminders(undefined, NOW_MS)).toEqual([]);
    expect(planSessionReminders("soon", NOW_MS)).toEqual([]);
  });
});

describe("buildSessionReminderPayload", () => {
  const base = {
    sessionId: SESSION_ID,
    title: "Midterm review",
    className: "Algorithms",
    startsAt: isoAt(3 * HOUR_MS),
    endsAt: isoAt(5 * HOUR_MS),
    timezone: "Asia/Jakarta",
    reminderType: "3h" as const,
    nowMs: NOW_MS,
  };

  it("links to the session and tags the notification by start time", () => {
    const payload = buildSessionReminderPayload(base);

    expect(payload).not.toBeNull();
    expect(payload?.url).toBe(`/sessions/${SESSION_ID}`);
    expect(payload?.tag).toBe(
      `starstask:session:${SESSION_ID}:3h:${base.startsAt}`,
    );
  });

  it("phrases the body in the reader's time zone", () => {
    const payload = buildSessionReminderPayload(base);

    expect(payload?.title).toBe("StarsTask: Session in a few hours");
    expect(payload?.body).toContain("Algorithms");
    expect(payload?.body).toContain("Midterm review");
    expect(payload?.body).toContain("3 hours");
    // 15:00 UTC is 22:00 in Jakarta.
    expect(payload?.body).toContain("22:00");
    expect(payload?.body).toContain("WIB");
  });

  it("uses a different headline for the 24-hour reminder", () => {
    const payload = buildSessionReminderPayload({
      ...base,
      reminderType: "24h",
    });

    expect(payload?.title).toBe("StarsTask: Session tomorrow");
  });

  it("says '1 hour' rather than '1 hours'", () => {
    const payload = buildSessionReminderPayload({
      ...base,
      startsAt: isoAt(HOUR_MS),
      endsAt: isoAt(2 * HOUR_MS),
    });

    expect(payload?.body).toContain("starts in 1 hour");
  });

  it("rejects an id that is not a UUID", () => {
    expect(
      buildSessionReminderPayload({ ...base, sessionId: "not-a-uuid" }),
    ).toBeNull();
  });

  it("rejects an unparseable start", () => {
    expect(
      buildSessionReminderPayload({ ...base, startsAt: "tomorrow" }),
    ).toBeNull();
  });
});

describe("evaluateSessionReminder", () => {
  it("sends for a scheduled session with reminders enabled", () => {
    const decision = evaluateSessionReminder(claim(), NOW_MS);

    expect(decision.kind).toBe("send");
    if (decision.kind === "send") {
      expect(decision.payload.url).toBe(`/sessions/${SESSION_ID}`);
    }
  });

  it("skips a cancelled session", () => {
    expect(
      evaluateSessionReminder(claim({ session_status: "cancelled" }), NOW_MS),
    ).toEqual({ kind: "skip", reason: "session_not_scheduled" });
  });

  it("skips a completed session", () => {
    expect(
      evaluateSessionReminder(claim({ session_status: "completed" }), NOW_MS),
    ).toEqual({ kind: "skip", reason: "session_not_scheduled" });
  });

  it("skips a session that was rescheduled after the reminder was queued", () => {
    expect(
      evaluateSessionReminder(
        claim({ current_starts_at: isoAt(30 * HOUR_MS) }),
        NOW_MS,
      ),
    ).toEqual({ kind: "skip", reason: "schedule_changed" });
  });

  it("skips when push was turned off", () => {
    expect(
      evaluateSessionReminder(claim({ push_enabled: false }), NOW_MS),
    ).toEqual({ kind: "skip", reason: "push_disabled" });
  });

  it("skips when that reminder window was turned off", () => {
    expect(
      evaluateSessionReminder(claim({ reminder_24h: false }), NOW_MS),
    ).toEqual({ kind: "skip", reason: "reminder_disabled" });
  });

  it("only honours the window that matches the reminder type", () => {
    const decision = evaluateSessionReminder(
      claim({ reminder_type: "3h", reminder_24h: false }),
      NOW_MS,
    );

    expect(decision.kind).toBe("send");
  });

  it("skips a row whose session id cannot be trusted", () => {
    expect(
      evaluateSessionReminder(claim({ session_id: "nope" }), NOW_MS),
    ).toEqual({ kind: "skip", reason: "invalid_payload" });
  });

  it("falls back to the session zone when the user has no preference", () => {
    const decision = evaluateSessionReminder(
      claim({ pref_timezone: null }),
      NOW_MS,
    );

    expect(decision.kind).toBe("send");
    if (decision.kind === "send") {
      expect(decision.payload.body).toContain("WIB");
    }
  });
});

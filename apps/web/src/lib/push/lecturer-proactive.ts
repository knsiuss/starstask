/**
 * Payload and planner for proactive lecturer alerts.
 *
 * Lecturers get one inbox/push notification per week per subject/offering when
 * something needs attention: a supervised student below 75% attendance, or an
 * offering under target pace. The cron only enqueues events; delivery runs
 * through the existing `notification-events` pipeline.
 *
 * Pure module: no Supabase imports, safe to unit test.
 */

import { isSafeNotificationPath } from "@/lib/push/payload";

export const LECTURER_ALERT_AT_RISK = "attendance_at_risk" as const;
export const LECTURER_ALERT_BEHIND_PACE = "teaching_behind_pace" as const;
export const LECTURER_ALERT_KINDS = [
  LECTURER_ALERT_AT_RISK,
  LECTURER_ALERT_BEHIND_PACE,
] as const;

export type LecturerAlertKind = (typeof LECTURER_ALERT_KINDS)[number];

export type LecturerAlertPayload = {
  title: string;
  body: string;
  url: string;
};

export type AtRiskAlertInput = {
  classId: string;
  subjectId: string;
  subjectName: string;
  atRiskCount: number;
  classSlug: string;
  isoWeek: string;
};

export type BehindPaceAlertInput = {
  offeringId: string;
  courseName: string;
  meetingsHeld: number;
  targetMeetings: number;
  classSlug: string;
  isoWeek: string;
};

export type AtRiskSubjectCandidate = {
  classId: string;
  classSlug: string;
  subjectId: string;
  subjectName: string;
  atRiskCount: number;
};

export type PaceOfferingCandidate = {
  offeringId: string;
  classId: string;
  classSlug: string;
  courseName: string;
  meetingsHeld: number;
  targetMeetings: number;
};

export type ClassAdminCandidate = {
  classId: string;
  userId: string;
};

export type PlannedLecturerAlert = {
  userId: string;
  kind: LecturerAlertKind;
  dedupeKey: string;
  payload: LecturerAlertPayload;
};

export const ATTENDANCE_AT_RISK_THRESHOLD_PERCENT = 75;
export const TARGET_MEETINGS_MIN = 14;
export const TARGET_MEETINGS_MAX = 16;
export const TARGET_MEETINGS_DEFAULT = 14;

export function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1)}…`;
}

/**
 * ISO week key in the Asia/Jakarta (WIB) calendar — the same calendar the
 * SQL `to_char(..., 'IYYY-"W"IW')` at `v_iso_week` uses, so JS and SQL agree
 * on which week a cron run belongs to.
 */
export function isoWeekKeyForDate(date: Date): string {
  // WIB is fixed at UTC+7 (no DST), so the arithmetic is a simple shift.
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const utc = new Date(
    Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()),
  );
  const dayNum = utc.getUTCDay() || 7;

  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );

  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// `isoWeekKeyForDate` returns "2026-W47"; the SQL side emits the same string via
// to_char(v_now at time zone 'Asia/Jakarta', 'IYYY-"W"IW'), so a JS-planned
// key always matches the RPC's dedupe key for the same instant.

export function clampTargetMeetings(input: number | null | undefined): number {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return TARGET_MEETINGS_DEFAULT;
  }

  return Math.min(
    TARGET_MEETINGS_MAX,
    Math.max(TARGET_MEETINGS_MIN, Math.trunc(input)),
  );
}

/**
 * Dedupe key per (admin, class/subject, ISO week). The unique index on
 * `notification_events.dedupe_key` alone would otherwise let only the first
 * administering lecturer's insert survive and silently drop the rest — the
 * cron calls `enqueue_lecturer_proactive_alerts` once per class admin.
 */
export function buildAttendanceAtRiskDedupeKey(
  classId: string,
  subjectId: string,
  adminUserId: string,
  isoWeek: string,
): string {
  return `attendance_at_risk:${classId}:${subjectId}:${adminUserId}:${isoWeek}`;
}

export function buildTeachingBehindPaceDedupeKey(
  offeringId: string,
  adminUserId: string,
  isoWeek: string,
): string {
  return `teaching_behind_pace:${offeringId}:${adminUserId}:${isoWeek}`;
}

export function isLecturerAlertUrlAllowed(value: string): boolean {
  return isSafeNotificationPath(value);
}

export function buildAttendanceAtRiskPayload(
  input: AtRiskAlertInput,
): LecturerAlertPayload | null {
  const path = `/classes/${input.classSlug}/attendance`;

  if (!isSafeNotificationPath(path)) {
    return null;
  }

  const count = Number.isFinite(input.atRiskCount)
    ? Math.max(0, Math.trunc(input.atRiskCount))
    : 0;
  const noun = count === 1 ? "student" : "students";
  const course = truncate(input.subjectName.trim(), 60) || "the subject";

  return {
    title: truncate("Attendance at risk", 120),
    body: truncate(
      `${count} ${noun} in ${course} under ${ATTENDANCE_AT_RISK_THRESHOLD_PERCENT}% attendance`,
      240,
    ),
    url: path,
  };
}

export function buildTeachingBehindPacePayload(
  input: BehindPaceAlertInput,
): LecturerAlertPayload | null {
  const path = `/classes/${input.classSlug}/attendance`;

  if (!isSafeNotificationPath(path)) {
    return null;
  }

  const held = Number.isFinite(input.meetingsHeld)
    ? Math.max(0, Math.trunc(input.meetingsHeld))
    : 0;
  const target = clampTargetMeetings(input.targetMeetings);
  const course = truncate(input.courseName.trim(), 60) || "The offering";

  return {
    title: truncate("Below target pace", 120),
    body: truncate(
      `${course} is below target pace (${held}/${target} meetings)`,
      240,
    ),
    url: path,
  };
}

export function isAtRiskPercentage(percentage: number | null): boolean {
  return (
    percentage !== null &&
    Number.isFinite(percentage) &&
    percentage < ATTENDANCE_AT_RISK_THRESHOLD_PERCENT
  );
}

export function resolveBehindPaceTarget(
  meetings: readonly { targetMeetings?: number | null }[],
): number {
  const configured = meetings.reduce((max, meeting) => {
    if (
      typeof meeting.targetMeetings === "number" &&
      Number.isFinite(meeting.targetMeetings)
    ) {
      return Math.max(max, Math.trunc(meeting.targetMeetings));
    }

    return max;
  }, 0);

  if (configured <= 0) {
    return TARGET_MEETINGS_DEFAULT;
  }

  return clampTargetMeetings(configured);
}

/**
 * Plans the enqueue calls a cron run should make.
 *
 * Pure: takes candidate rows + class admins + an ISO week key, returns the
 * list of notification events to enqueue. The database RPC does the same
 * computation server-side; this mirror exists so the planning logic can be
 * tested without a database and so the web route can fail closed on shape
 * drift before hitting the network.
 */
export function buildLecturerAlerts(input: {
  isoWeek: string;
  atRiskSubjects: readonly AtRiskSubjectCandidate[];
  paceOfferings: readonly PaceOfferingCandidate[];
  classAdmins: readonly ClassAdminCandidate[];
}): PlannedLecturerAlert[] {
  const adminsByClass = new Map<string, string[]>();

  for (const admin of input.classAdmins) {
    const list = adminsByClass.get(admin.classId) ?? [];

    if (!list.includes(admin.userId)) {
      list.push(admin.userId);
    }

    adminsByClass.set(admin.classId, list);
  }

  const planned: PlannedLecturerAlert[] = [];

  for (const subject of input.atRiskSubjects) {
    if (subject.atRiskCount <= 0) {
      continue;
    }

    const payload = buildAttendanceAtRiskPayload({
      classId: subject.classId,
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      atRiskCount: subject.atRiskCount,
      classSlug: subject.classSlug,
      isoWeek: input.isoWeek,
    });

    if (!payload) {
      continue;
    }

    for (const userId of adminsByClass.get(subject.classId) ?? []) {
      const dedupeKey = buildAttendanceAtRiskDedupeKey(
        subject.classId,
        subject.subjectId,
        userId,
        input.isoWeek,
      );

      planned.push({
        userId,
        kind: LECTURER_ALERT_AT_RISK,
        dedupeKey,
        payload,
      });
    }
  }

  for (const offering of input.paceOfferings) {
    if (offering.meetingsHeld >= clampTargetMeetings(offering.targetMeetings)) {
      continue;
    }

    const payload = buildTeachingBehindPacePayload({
      offeringId: offering.offeringId,
      courseName: offering.courseName,
      meetingsHeld: offering.meetingsHeld,
      targetMeetings: offering.targetMeetings,
      classSlug: offering.classSlug,
      isoWeek: input.isoWeek,
    });

    if (!payload) {
      continue;
    }

    for (const userId of adminsByClass.get(offering.classId) ?? []) {
      const dedupeKey = buildTeachingBehindPaceDedupeKey(
        offering.offeringId,
        userId,
        input.isoWeek,
      );

      planned.push({
        userId,
        kind: LECTURER_ALERT_BEHIND_PACE,
        dedupeKey,
        payload,
      });
    }
  }

  return planned;
}

export type ProactiveSummary = {
  atRiskSubjects: number;
  behindPaceOfferings: number;
};

/**
 * Compact summary returned by the `enqueue_lecturer_proactive_alerts` RPC. It
 * refuses to trust non-object shapes so the cron never reports a false success
 * when the RPC payload drifts.
 */
export function readProactiveSummary(data: unknown): ProactiveSummary | null {
  const record =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;

  if (!record) {
    return null;
  }

  const atRiskSubjects =
    typeof record.at_risk_subjects === "number"
      ? record.at_risk_subjects
      : Number(record.at_risk_subjects);
  const behindPaceOfferings =
    typeof record.behind_pace_offerings === "number"
      ? record.behind_pace_offerings
      : Number(record.behind_pace_offerings);

  if (
    !Number.isFinite(atRiskSubjects) ||
    !Number.isFinite(behindPaceOfferings)
  ) {
    return null;
  }

  return { atRiskSubjects, behindPaceOfferings };
}

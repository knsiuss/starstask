export type AttendanceOutcome =
  "present" | "late" | "excused" | "sick" | "absent" | "pending" | "unrecorded";

export type AttendanceSummaryCounts = {
  present: number;
  late: number;
  excused: number;
  sick: number;
  absent: number;
  unrecorded: number;
  pending: number;
  /** Sessions that count toward the percentage denominator. */
  eligible: number;
  /** Sessions the student attended: present plus late. */
  attended: number;
  /** `null` when no session is eligible yet, so the UI can show a dash. */
  percentage: number | null;
};

/**
 * One policy, used by the Dashboard, the Attendance page, and the class
 * summary.
 *
 * - Denominator: present + late + absent + not recorded. A missing record is
 *   never silently counted as present.
 * - Excused and sick sessions are left out of the denominator: an approved
 *   absence is neither attendance nor an unexplained miss.
 * - Pending (not yet finished) sessions are not counted at all.
 * - Late attendance counts as attended. The number of late sessions is still
 *   reported separately so the policy can tighten later without changing the
 *   stored data.
 */
export function summarizeAttendance(
  outcomes: readonly AttendanceOutcome[],
): AttendanceSummaryCounts {
  const counts: AttendanceSummaryCounts = {
    present: 0,
    late: 0,
    excused: 0,
    sick: 0,
    absent: 0,
    unrecorded: 0,
    pending: 0,
    eligible: 0,
    attended: 0,
    percentage: null,
  };

  for (const outcome of outcomes) {
    counts[outcome] += 1;
  }

  return summarizeAttendanceCounts(counts);
}

export type AttendanceCountsInput = Pick<
  AttendanceSummaryCounts,
  "present" | "late" | "excused" | "sick" | "absent" | "unrecorded" | "pending"
>;

/**
 * Same policy for callers that already hold counts, such as the class summary
 * computed by Postgres.
 */
export function summarizeAttendanceCounts(
  input: AttendanceCountsInput,
): AttendanceSummaryCounts {
  const attended = input.present + input.late;
  const eligible = attended + input.absent + input.unrecorded;

  return {
    ...input,
    attended,
    eligible,
    percentage:
      eligible === 0 ? null : Math.round((attended / eligible) * 1_000) / 10,
  };
}

/** One decimal at most, or a dash when nothing is eligible yet. */
export function formatAttendancePercentage(percentage: number | null): string {
  if (percentage === null) {
    return "—";
  }

  return `${Number.isInteger(percentage) ? percentage : percentage.toFixed(1)}%`;
}

export type CheckInDayStatus =
  "present" | "late" | "excused" | "sick" | "absent";

export type CheckInDaySession = {
  /** ISO instant when the check-in window opens. */
  opensAt: string;
  /** ISO instant when the check-in window closes. */
  closesAt: string;
  /** The stored attendance row, or null when nothing was recorded. */
  status: CheckInDayStatus | null;
};

export type CheckInDayCounts = {
  present: number;
  late: number;
  notCheckedIn: number;
};

/**
 * Today's check-in strip: recorded present/late rows, plus sessions whose
 * window is open and that have no row yet.
 *
 * A session that closed without a row is history, not "not checked in", so it is
 * deliberately left out of all three counts. Excused and absent rows do not
 * belong in a check-in summary either.
 */
export function summarizeCheckInDay(
  sessions: readonly CheckInDaySession[],
  nowMs: number,
): CheckInDayCounts {
  const counts: CheckInDayCounts = { present: 0, late: 0, notCheckedIn: 0 };

  for (const session of sessions) {
    if (session.status === "present") {
      counts.present += 1;
      continue;
    }

    if (session.status === "late") {
      counts.late += 1;
      continue;
    }

    if (session.status !== null) {
      continue;
    }

    const opensAt = Date.parse(session.opensAt);
    const closesAt = Date.parse(session.closesAt);

    if (
      Number.isFinite(opensAt) &&
      Number.isFinite(closesAt) &&
      nowMs >= opensAt &&
      nowMs <= closesAt
    ) {
      counts.notCheckedIn += 1;
    }
  }

  return counts;
}

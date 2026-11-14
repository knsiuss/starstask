import type { AttendanceMeetingCellStatus } from "@starstask/contracts";
import type { AttendanceOutcome } from "@starstask/shared";
import { summarizeAttendance, sortAttendanceRoster } from "@starstask/shared";

import {
  toAttendanceCellStatus,
  type AttendanceMeetingListItem,
  type AttendanceRecap,
  type AttendanceRecapMeeting,
  type AttendanceRecapStudent,
  type AttendanceRosterMember,
} from "@/lib/attendance/meeting-types";

export type AttendanceRecapCell = {
  sessionId: string;
  userId: string;
  eligible: boolean;
  status: string;
};

/** NR older than this after finalization counts as absent (24 hours). */
const NR_ABSENT_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Builds the semester matrix.
 *
 * A meeting whose attendance was never opened is shown as not applicable and is
 * excluded from every total, so an upcoming meeting cannot lower a student's
 * percentage. NR (`not_recorded`) still counts in the denominator once the
 * meeting was opened, matching the attendance policy used elsewhere.
 */
export function buildAttendanceRecap(input: {
  meetings: AttendanceMeetingListItem[];
  roster: AttendanceRosterMember[];
  cells: AttendanceRecapCell[];
}): AttendanceRecap {
  const sortedMeetings = [...input.meetings].sort(
    (left, right) =>
      left.meetingNumber - right.meetingNumber ||
      Date.parse(left.startsAt) - Date.parse(right.startsAt),
  );

  const meetings: AttendanceRecapMeeting[] = sortedMeetings.map((meeting) => ({
    sessionId: meeting.sessionId,
    meetingNumber: meeting.meetingNumber,
    meetingDate: meeting.meetingDate,
    startsAt: meeting.startsAt,
    endsAt: meeting.endsAt,
    title: meeting.title,
    location: meeting.location,
    opensAt: meeting.opensAt,
    closesAt: meeting.closesAt,
    openedAt: meeting.openedAt,
    closedAt: meeting.closedAt,
    finalizedAt: meeting.finalizedAt,
    phase: meeting.phase,
    opened: meeting.openedAt !== null,
  }));

  const cellByKey = new Map(
    input.cells.map((cell) => [
      recapCellKey(cell.sessionId, cell.userId),
      cell,
    ]),
  );

  // The roster is class-wide, but recap cells only exist for members of
  // this subject. A class member with no cell at all for this subject
  // (e.g. a repeat student taking another course) must not get a row here:
  // an all-not_applicable row would read as 0% and drag the sheet average
  // down. Late joiners keep their row because the recap still returns an
  // (ineligible) cell for them. When there are no cells at all there is
  // nothing to scope by, so the full roster is kept.
  const enrolledUserIds = new Set(input.cells.map((cell) => cell.userId));
  const scopedRoster =
    input.cells.length > 0
      ? input.roster.filter((member) => enrolledUserIds.has(member.userId))
      : input.roster;

  const students = sortAttendanceRoster(
    scopedRoster.map((member): AttendanceRecapStudent => {
      const cells: Record<string, AttendanceMeetingCellStatus> = {};
      const outcomes: AttendanceOutcome[] = [];
      let present = 0;
      let late = 0;
      let excused = 0;
      let sick = 0;
      let absent = 0;
      let notRecorded = 0;

      for (const meeting of meetings) {
        const cell = cellByKey.get(
          recapCellKey(meeting.sessionId, member.userId),
        );
        const status = !meeting.opened
          ? "not_applicable"
          : cell === undefined || !cell.eligible
            ? "not_applicable"
            : toAttendanceCellStatus(cell.status);

        cells[meeting.sessionId] = status;

        if (status === "present") {
          present += 1;
          outcomes.push("present");
        } else if (status === "late") {
          late += 1;
          outcomes.push("late");
        } else if (status === "excused") {
          excused += 1;
          outcomes.push("excused");
        } else if (status === "sick") {
          sick += 1;
          outcomes.push("sick");
        } else if (status === "absent") {
          absent += 1;
          outcomes.push("absent");
        } else if (status === "not_recorded") {
          // Policy: a meeting finalized more than 24h ago with no record
          // counts as absent (no-show), not merely unrecorded. Recent
          // meetings stay NR so lecturers can still record late arrivals.
          const finalizedOverdue =
            meeting.finalizedAt !== null &&
            Date.now() - Date.parse(meeting.finalizedAt) > NR_ABSENT_AFTER_MS;

          if (finalizedOverdue) {
            absent += 1;
            outcomes.push("absent");
          } else {
            notRecorded += 1;
            outcomes.push("unrecorded");
          }
        }
      }

      const summary = summarizeAttendance(outcomes);

      return {
        userId: member.userId,
        fullName: member.fullName,
        nim: member.nim,
        joinedAt: member.joinedAt,
        cells,
        totals: {
          present,
          late,
          excused,
          sick,
          absent,
          notRecorded,
          attended: summary.attended,
          eligible: summary.eligible,
          percentage: summary.percentage,
        },
      };
    }),
  );

  return { meetings, students };
}

function recapCellKey(sessionId: string, userId: string): string {
  return `${sessionId}:${userId}`;
}

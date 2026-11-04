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

  const students = sortAttendanceRoster(
    input.roster.map((member): AttendanceRecapStudent => {
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
          notRecorded += 1;
          outcomes.push("unrecorded");
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

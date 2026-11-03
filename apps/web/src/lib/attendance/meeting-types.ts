import {
  ATTENDANCE_MEETING_CELL_STATUSES,
  type AttendanceMeetingCellStatus,
  type AttendanceMeetingPhase,
} from "@starstask/contracts";

import type { AttendanceCheckInStatus } from "@/lib/attendance/types";

/** Counts shown on the manager dashboard and in the per-meeting export. */
export type AttendanceMeetingCounts = {
  expected: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  notRecorded: number;
  failed: number;
};

export type AttendanceMeetingListItem = {
  sessionId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  meetingNumber: number;
  meetingDate: string | null;
  title: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  opensAt: string | null;
  closesAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  finalizedAt: string | null;
  radiusM: number;
  lateAfterMinutes: number;
  phase: AttendanceMeetingPhase;
  counts: AttendanceMeetingCounts;
};

export type AttendanceMeetingFailureOutcome =
  | "name_mismatch"
  | "nim_mismatch"
  | "identity_missing"
  | "outside_radius"
  | "imprecise"
  | "closed"
  | "not_open"
  | "not_available";

export type AttendanceMeetingFailure = {
  userId: string;
  displayName: string;
  outcome: AttendanceMeetingFailureOutcome;
  distanceM: number | null;
  accuracyM: number | null;
  createdAt: string;
};

export type AttendanceMeetingRosterEntry = {
  userId: string;
  fullName: string;
  nim: string | null;
  displayName: string | null;
  joinedAt: string;
  eligible: boolean;
  status: AttendanceMeetingCellStatus;
  method: "geo" | "manual" | "system" | null;
  checkedInAt: string | null;
  distanceM: number | null;
  accuracyM: number | null;
  note: string | null;
  reviewedAt: string | null;
  identityVerified: boolean;
};

export type AttendanceMeetingDetail = AttendanceMeetingListItem & {
  roster: AttendanceMeetingRosterEntry[];
  failures: AttendanceMeetingFailure[];
};

export type AttendanceCorrectionAuditEntry = {
  id: string;
  sessionId: string;
  meetingNumber: number | null;
  meetingDate: string | null;
  studentId: string;
  studentNim: string | null;
  studentName: string;
  subjectId: string | null;
  subjectName: string | null;
  previousStatus: string;
  newStatus: string;
  reason: string;
  physicallyVerified: boolean;
  verificationMethod: string;
  adminName: string;
  createdAt: string;
};

export type AttendanceRosterMember = {
  userId: string;
  fullName: string;
  nim: string | null;
  displayName: string | null;
  joinedAt: string;
};

export type StudentAttendanceMeeting = {
  sessionId: string;
  classId: string;
  classSlug: string;
  className: string;
  classCode: string | null;
  courseName: string;
  semester: string;
  academicYear: string;
  subjectId: string | null;
  subjectName: string;
  subjectCode: string | null;
  meetingNumber: number;
  meetingDate: string | null;
  title: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  opensAt: string | null;
  closesAt: string | null;
  phase: AttendanceMeetingPhase;
  radiusM: number;
  lateAfterMinutes: number;
  checkIn: {
    status: AttendanceCheckInStatus;
    checkedInAt: string;
    distanceM: number | null;
  } | null;
};

export type StudentAttendanceMeetingView = {
  hasClasses: boolean;
  identity: { fullName: string | null; nim: string | null };
  meetings: StudentAttendanceMeeting[];
};

export type AttendanceRecapMeeting = {
  sessionId: string;
  meetingNumber: number;
  meetingDate: string | null;
  startsAt: string;
  endsAt: string;
  title: string;
  location: string | null;
  opensAt: string | null;
  closesAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  finalizedAt: string | null;
  phase: AttendanceMeetingPhase;
  /** False when attendance was never opened; such a meeting is not counted. */
  opened: boolean;
};

export type AttendanceRecapTotals = {
  present: number;
  late: number;
  excused: number;
  absent: number;
  notRecorded: number;
  attended: number;
  eligible: number;
  percentage: number | null;
};

export type AttendanceRecapStudent = {
  userId: string;
  fullName: string;
  nim: string | null;
  joinedAt: string;
  cells: Record<string, AttendanceMeetingCellStatus>;
  totals: AttendanceRecapTotals;
};

export type AttendanceRecap = {
  meetings: AttendanceRecapMeeting[];
  students: AttendanceRecapStudent[];
};

const CELL_STATUS_SET = new Set<string>(ATTENDANCE_MEETING_CELL_STATUSES);

/** Narrows a database string to a known cell status. */
export function toAttendanceCellStatus(
  value: string | null | undefined,
  fallback: AttendanceMeetingCellStatus = "not_recorded",
): AttendanceMeetingCellStatus {
  return value && CELL_STATUS_SET.has(value)
    ? (value as AttendanceMeetingCellStatus)
    : fallback;
}

import type { SessionType } from "@starstask/contracts";

export type AttendanceCheckInStatus = "present" | "late" | "excused" | "absent";

/**
 * One in-person session the student may check in to right now.
 *
 * The raw room coordinates are intentionally absent: the server verifies the
 * distance and the client only needs the radius to explain the rule.
 */
export type ActiveAttendanceSession = {
  sessionId: string;
  classId: string;
  classSlug: string;
  className: string;
  classCode: string | null;
  courseName: string;
  semester: string;
  /** Course the session belongs to, when the session carries one. */
  subjectId: string | null;
  subjectName: string | null;
  title: string;
  organizerName: string;
  sessionType: SessionType;
  location: string | null;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  radiusM: number;
  checkIn: {
    status: AttendanceCheckInStatus;
    checkedInAt: string;
    distanceM: number | null;
  } | null;
};

export type AttendanceTodayCounts = {
  present: number;
  late: number;
  notCheckedIn: number;
};

export type AttendanceCheckInView = {
  hasClasses: boolean;
  todayDateKey: string;
  today: AttendanceTodayCounts;
  activeSessions: ActiveAttendanceSession[];
};

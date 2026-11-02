import "server-only";

import { resolveAttendanceMeetingPhase } from "@starstask/contracts";
import { sortAttendanceRoster } from "@starstask/shared";

import {
  toAttendanceCellStatus,
  type AttendanceMeetingDetail,
  type AttendanceMeetingFailure,
  type AttendanceMeetingFailureOutcome,
  type AttendanceMeetingListItem,
  type AttendanceMeetingRosterEntry,
  type AttendanceRecap,
  type AttendanceRosterMember,
  type StudentAttendanceMeeting,
  type StudentAttendanceMeetingView,
} from "@/lib/attendance/meeting-types";
import { buildAttendanceRecap } from "@/lib/attendance/recap";
import type { AttendanceCheckInStatus } from "@/lib/attendance/types";
import { DataAccessError } from "@/lib/db/assignments";
import { listMyClasses } from "@/lib/db/classes";
import { getMyProfile } from "@/lib/db/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type MeetingListRow =
  Database["public"]["Functions"]["class_attendance_meeting_list"]["Returns"][number];
type MeetingRosterRow =
  Database["public"]["Functions"]["attendance_meeting_roster"]["Returns"][number];
type MeetingFailureRow =
  Database["public"]["Functions"]["attendance_meeting_failures"]["Returns"][number];
type ClassRosterRow =
  Database["public"]["Functions"]["class_attendance_roster"]["Returns"][number];

type StudentMeetingRow = {
  id: string;
  class_id: string;
  subject_id: string | null;
  meeting_number: number | null;
  meeting_date: string | null;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string;
  attendance_opens_at: string | null;
  attendance_closes_at: string | null;
  attendance_opened_at: string | null;
  attendance_closed_at: string | null;
  attendance_finalized_at: string | null;
  late_after_minutes: number;
};

type CheckInSettingsRow = {
  has_location: boolean;
  radius_m: number;
};

type StudentCheckInRow = {
  session_id: string;
  status: AttendanceCheckInStatus;
  checked_in_at: string;
  distance_m: number | null;
};

// `checkin_radius_m` is intentionally absent: the column is not granted to
// clients, so the radius comes from the `session_checkin_summary` helper.
const STUDENT_MEETING_COLUMNS =
  "id, class_id, subject_id, meeting_number, meeting_date, title, location, starts_at, ends_at, attendance_opens_at, attendance_closes_at, attendance_opened_at, attendance_closed_at, attendance_finalized_at, late_after_minutes";

/** How far ahead the student attendance list looks for upcoming meetings. */
const UPCOMING_WINDOW_MS = 14 * 24 * 60 * 60 * 1_000;
const STUDENT_MEETING_LIMIT = 20;
const MAX_ROWS = 5_000;

const FAILURE_OUTCOMES = new Set<AttendanceMeetingFailureOutcome>([
  "name_mismatch",
  "nim_mismatch",
  "identity_missing",
  "outside_radius",
  "imprecise",
  "closed",
  "not_open",
  "not_available",
]);

const CHECK_IN_STATUSES = new Set<AttendanceCheckInStatus>([
  "present",
  "late",
  "excused",
  "absent",
]);

export function mapAttendanceMeetingRow(
  row: MeetingListRow,
  nowMs: number,
): AttendanceMeetingListItem {
  return {
    sessionId: row.session_id,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    subjectCode: row.subject_code,
    meetingNumber: row.meeting_number,
    meetingDate: row.meeting_date,
    title: row.title,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    opensAt: row.attendance_opens_at,
    closesAt: row.attendance_closes_at,
    openedAt: row.attendance_opened_at,
    closedAt: row.attendance_closed_at,
    finalizedAt: row.attendance_finalized_at,
    radiusM: row.radius_m,
    lateAfterMinutes: row.late_after_minutes,
    phase: resolveAttendanceMeetingPhase(
      {
        attendance_opened_at: row.attendance_opened_at,
        attendance_closed_at: row.attendance_closed_at,
        attendance_finalized_at: row.attendance_finalized_at,
        attendance_closes_at: row.attendance_closes_at,
        ends_at: row.ends_at,
      },
      nowMs,
    ),
    counts: {
      expected: row.expected_count,
      present: row.present_count,
      late: row.late_count,
      excused: row.excused_count,
      absent: row.absent_count,
      notRecorded: row.not_recorded_count,
      failed: row.failed_count,
    },
  };
}

/** Every attendance meeting of a class, newest meeting number first. */
export async function listClassAttendanceMeetings(
  classId: string,
  now: Date = new Date(),
): Promise<AttendanceMeetingListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("class_attendance_meeting_list", {
    p_class_id: classId,
  });

  if (error) {
    throw new DataAccessError("Could not load attendance meetings", error.code);
  }

  return (data ?? []).map((row) => mapAttendanceMeetingRow(row, now.getTime()));
}

/** Which class owns a meeting; used to scope manager routes by class slug. */
export async function getAttendanceMeetingClassId(
  sessionId: string,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("discussion_sessions")
    .select("class_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new DataAccessError(
      "Could not load the attendance meeting",
      error.code,
    );
  }

  return data?.class_id ?? null;
}

/**
 * Meeting metadata, the alphabetical master roster, and recent verification
 * failures. Every call is re-authorized by the database functions.
 */
export async function getAttendanceMeetingDetail(
  sessionId: string,
  classId: string,
  now: Date = new Date(),
): Promise<AttendanceMeetingDetail | null> {
  const meetings = await listClassAttendanceMeetings(classId, now);
  const meeting = meetings.find((item) => item.sessionId === sessionId);

  if (!meeting) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const [rosterResult, failuresResult] = await Promise.all([
    supabase.rpc("attendance_meeting_roster", { p_session_id: sessionId }),
    supabase.rpc("attendance_meeting_failures", { p_session_id: sessionId }),
  ]);

  if (rosterResult.error) {
    throw new DataAccessError(
      "Could not load the meeting roster",
      rosterResult.error.code,
    );
  }

  if (failuresResult.error) {
    throw new DataAccessError(
      "Could not load verification failures",
      failuresResult.error.code,
    );
  }

  const roster = sortAttendanceRoster(
    (rosterResult.data ?? []).map(mapRosterRow),
  );
  const failures = (failuresResult.data ?? []).map(mapFailureRow);

  return { ...meeting, roster, failures };
}

export type ClassAttendanceSubject = {
  id: string;
  name: string;
  code: string | null;
  lecturerName: string | null;
};

/** Subject identity used by the exports; scoped to the class in the URL. */
export async function getClassAttendanceSubject(
  classId: string,
  subjectId: string,
): Promise<ClassAttendanceSubject | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_subjects")
    .select("id, name, code, lecturer_name")
    .eq("id", subjectId)
    .eq("class_id", classId)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not load the subject", error.code);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    code: data.code,
    lecturerName: data.lecturer_name,
  };
}

/** Master roster of a class, independent of any submitted attendance. */
export async function listClassAttendanceRoster(
  classId: string,
): Promise<AttendanceRosterMember[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("class_attendance_roster", {
    p_class_id: classId,
  });

  if (error) {
    throw new DataAccessError("Could not load the class roster", error.code);
  }

  return sortAttendanceRoster((data ?? []).map(mapClassRosterRow));
}

/** Semester recap matrix for one subject. */
export async function getClassAttendanceRecap(
  classId: string,
  subjectId: string,
  now: Date = new Date(),
): Promise<AttendanceRecap> {
  const supabase = await createSupabaseServerClient();
  const [meetings, roster, cellsResult] = await Promise.all([
    listClassAttendanceMeetings(classId, now),
    listClassAttendanceRoster(classId),
    supabase.rpc("class_attendance_recap", {
      p_class_id: classId,
      p_subject_id: subjectId,
    }),
  ]);

  if (cellsResult.error) {
    throw new DataAccessError(
      "Could not load the attendance recap",
      cellsResult.error.code,
    );
  }

  const cells = (cellsResult.data ?? []).map((row) => ({
    sessionId: row.session_id,
    userId: row.user_id,
    eligible: row.eligible,
    status: row.status,
  }));

  return buildAttendanceRecap({
    meetings: meetings.filter((meeting) => meeting.subjectId === subjectId),
    roster,
    cells,
  });
}

/**
 * Open and upcoming meetings for the signed-in student.
 *
 * The list is a convenience: the check-in function re-checks membership, the
 * join date, the meeting window, identity, accuracy, and radius.
 */
export async function getStudentAttendanceMeetingView(
  userId: string,
  now: Date = new Date(),
): Promise<StudentAttendanceMeetingView> {
  const nowMs = now.getTime();
  const [classes, profile] = await Promise.all([
    listMyClasses(userId),
    getMyProfile(),
  ]);
  const activeClasses = classes.filter(
    (classItem) => classItem.status === "active",
  );
  const identity = {
    fullName: profile?.fullName?.trim() || null,
    nim: profile?.nim?.trim() || null,
  };

  if (activeClasses.length === 0) {
    return { hasClasses: classes.length > 0, identity, meetings: [] };
  }

  const membershipById = new Map(
    activeClasses.map((classItem) => [classItem.id, classItem]),
  );
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("discussion_sessions")
    .select(STUDENT_MEETING_COLUMNS)
    .in("class_id", [...membershipById.keys()])
    .eq("status", "scheduled")
    .not("meeting_number", "is", null)
    .gte("ends_at", new Date(nowMs - 24 * 60 * 60 * 1_000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(100);

  if (error) {
    throw new DataAccessError("Could not load attendance meetings", error.code);
  }

  const rows = (data ?? []) as StudentMeetingRow[];
  const visible = rows.filter((row) => {
    const membership = membershipById.get(row.class_id);

    if (!membership) {
      return false;
    }

    if (Date.parse(row.starts_at) < Date.parse(membership.joined_at)) {
      return false;
    }

    const phase = resolveAttendanceMeetingPhase(
      {
        attendance_opened_at: row.attendance_opened_at,
        attendance_closed_at: row.attendance_closed_at,
        attendance_finalized_at: row.attendance_finalized_at,
        attendance_closes_at: row.attendance_closes_at,
        ends_at: row.ends_at,
      },
      nowMs,
    );

    if (phase === "open") {
      return true;
    }

    if (phase !== "scheduled") {
      return false;
    }

    const startsAt = Date.parse(row.starts_at);

    return startsAt >= nowMs && startsAt <= nowMs + UPCOMING_WINDOW_MS;
  });

  if (visible.length === 0) {
    return { hasClasses: true, identity, meetings: [] };
  }

  const subjectIds = [
    ...new Set(
      visible.flatMap((row) => (row.subject_id ? [row.subject_id] : [])),
    ),
  ];
  const checkInBySession = new Map<string, StudentCheckInRow>();

  const [subjectsResult, checkInsResult] = await Promise.all([
    subjectIds.length > 0
      ? supabase
          .from("class_subjects")
          .select("id, name, code")
          .in("id", subjectIds)
          .limit(MAX_ROWS)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("discussion_session_checkins")
      .select("session_id, status, checked_in_at, distance_m")
      .eq("user_id", userId)
      .in(
        "session_id",
        visible.map((row) => row.id),
      )
      .limit(MAX_ROWS),
  ]);

  if (subjectsResult.error) {
    throw new DataAccessError(
      "Could not load the meeting subjects",
      subjectsResult.error.code,
    );
  }

  if (checkInsResult.error) {
    throw new DataAccessError(
      "Could not load your check-ins",
      checkInsResult.error.code,
    );
  }

  const subjectById = new Map(
    (subjectsResult.data ?? []).map((row) => [row.id, row]),
  );

  for (const row of (checkInsResult.data ?? []) as StudentCheckInRow[]) {
    if (CHECK_IN_STATUSES.has(row.status)) {
      checkInBySession.set(row.session_id, row);
    }
  }

  const selected = visible
    .sort(
      (left, right) => Date.parse(left.starts_at) - Date.parse(right.starts_at),
    )
    .slice(0, STUDENT_MEETING_LIMIT);

  const radiusBySession = new Map<string, number>();
  const settingsResults = await Promise.all(
    selected.map((row) =>
      supabase.rpc("session_checkin_summary", { p_session_id: row.id }),
    ),
  );

  for (const [index, result] of settingsResults.entries()) {
    const session = selected[index];

    if (!session || result.error) {
      continue;
    }

    const settings = (result.data ?? [])[0] as CheckInSettingsRow | undefined;

    if (settings) {
      radiusBySession.set(session.id, settings.radius_m);
    }
  }

  const meetings = selected.flatMap((row): StudentAttendanceMeeting[] => {
    const membership = membershipById.get(row.class_id);
    const subject = row.subject_id
      ? subjectById.get(row.subject_id)
      : undefined;

    if (!membership || row.meeting_number === null) {
      return [];
    }

    const checkIn = checkInBySession.get(row.id);

    return [
      {
        sessionId: row.id,
        classId: row.class_id,
        classSlug: membership.slug,
        className: membership.name,
        classCode: membership.class_code,
        courseName: membership.course_name,
        semester: membership.semester,
        academicYear: membership.academic_year,
        subjectId: row.subject_id ?? null,
        subjectName: subject?.name ?? membership.course_name,
        subjectCode: subject?.code ?? null,
        meetingNumber: row.meeting_number,
        meetingDate: row.meeting_date,
        title: row.title,
        location: row.location,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        opensAt: row.attendance_opens_at,
        closesAt: row.attendance_closes_at,
        phase: resolveAttendanceMeetingPhase(
          {
            attendance_opened_at: row.attendance_opened_at,
            attendance_closed_at: row.attendance_closed_at,
            attendance_finalized_at: row.attendance_finalized_at,
            attendance_closes_at: row.attendance_closes_at,
            ends_at: row.ends_at,
          },
          nowMs,
        ),
        // The database default when the helper is unavailable; the check-in
        // function still enforces the real radius server-side.
        radiusM: radiusBySession.get(row.id) ?? 150,
        lateAfterMinutes: row.late_after_minutes,
        checkIn: checkIn
          ? {
              status: checkIn.status,
              checkedInAt: checkIn.checked_in_at,
              distanceM: checkIn.distance_m,
            }
          : null,
      },
    ];
  });

  return { hasClasses: true, identity, meetings };
}

function mapRosterRow(row: MeetingRosterRow): AttendanceMeetingRosterEntry {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    nim: row.nim,
    displayName: row.display_name,
    joinedAt: row.joined_at,
    eligible: row.eligible,
    status: toAttendanceCellStatus(row.status),
    method: toCheckInMethod(row.method),
    checkedInAt: row.checked_in_at,
    distanceM: row.distance_m,
    accuracyM: row.accuracy_m,
    note: row.note,
    reviewedAt: row.reviewed_at,
    identityVerified: row.identity_verified,
  };
}

function mapFailureRow(row: MeetingFailureRow): AttendanceMeetingFailure {
  return {
    userId: row.user_id,
    displayName: row.display_name ?? "Member",
    outcome: FAILURE_OUTCOMES.has(
      row.outcome as AttendanceMeetingFailureOutcome,
    )
      ? (row.outcome as AttendanceMeetingFailureOutcome)
      : "not_available",
    distanceM: row.distance_m,
    accuracyM: row.accuracy_m,
    createdAt: row.created_at,
  };
}

function mapClassRosterRow(row: ClassRosterRow): AttendanceRosterMember {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    nim: row.nim,
    displayName: row.display_name,
    joinedAt: row.joined_at,
  };
}

function toCheckInMethod(
  value: string | null,
): "geo" | "manual" | "system" | null {
  return value === "geo" || value === "manual" || value === "system"
    ? value
    : null;
}

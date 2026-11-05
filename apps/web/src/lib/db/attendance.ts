import "server-only";

import {
  SESSION_CHECKIN_LEAD_MS,
  getSessionCheckInWindow,
  getSessionCheckInWindowState,
  type AttendanceDisplayStatus,
  type AttendanceQuery,
  type SessionType,
} from "@starstask/contracts";
import {
  APP_TIME_ZONE_OFFSET,
  summarizeAttendance,
  summarizeCheckInDay,
  toJakartaDateKey,
  type AttendanceOutcome,
  type AttendanceSummaryCounts,
} from "@starstask/shared";

import type {
  ActiveAttendanceSession,
  AttendanceCheckInStatus,
  AttendanceCheckInView,
} from "@/lib/attendance/types";
import { DataAccessError } from "@/lib/db/assignments";
import { listMyClasses, loadProfiles } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  SessionCheckInMethodRow,
  SessionStatusRow,
} from "@/types/database";

/** Hard ceiling for one page. Older history is reachable through the filters. */
const MAX_SESSIONS = 1_000;

export type AttendanceEntry = {
  sessionId: string;
  classId: string;
  classSlug: string;
  className: string;
  courseName: string;
  academicYear: string;
  semester: string;
  subjectId: string | null;
  subjectName: string | null;
  title: string;
  sessionType: SessionType;
  location: string | null;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  /** Jakarta calendar day of the session, used by the date-range filter. */
  dateKey: string;
  status: AttendanceDisplayStatus;
  checkedInAt: string | null;
  method: SessionCheckInMethodRow | null;
  note: string | null;
  reviewedAt: string | null;
  recordedByName: string | null;
};

export type AttendanceGroupSummary = {
  key: string;
  label: string;
  secondaryLabel: string | null;
  counts: AttendanceSummaryCounts;
};

export type AttendanceFilterOptions = {
  classes: {
    id: string;
    name: string;
    slug: string;
    semester: string;
    academicYear: string;
  }[];
  subjects: {
    id: string;
    name: string;
    code: string | null;
    classId: string;
    className: string;
  }[];
  academicYears: string[];
  semesters: string[];
};

export type StudentAttendanceView = {
  summary: AttendanceSummaryCounts;
  /** Sessions matching every filter, including the status filter. */
  entries: AttendanceEntry[];
  /** Sessions matching every filter except the status filter. */
  scopedTotal: number;
  byClass: AttendanceGroupSummary[];
  bySubject: AttendanceGroupSummary[];
  options: AttendanceFilterOptions;
};

type SessionRow = {
  id: string;
  class_id: string;
  assignment_id: string | null;
  subject_id: string | null;
  title: string;
  session_type: SessionType;
  location: string | null;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  status: SessionStatusRow;
};

type CheckInRow = {
  session_id: string;
  status: AttendanceOutcome;
  method: SessionCheckInMethodRow;
  checked_in_at: string;
  note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type MembershipInfo = {
  id: string;
  slug: string;
  name: string;
  course_name: string;
  semester: string;
  academic_year: string;
  joined_at: string;
};

function emptyView(options: AttendanceFilterOptions): StudentAttendanceView {
  return {
    summary: summarizeAttendance([]),
    entries: [],
    scopedTotal: 0,
    byClass: [],
    bySubject: [],
    options,
  };
}

function isFinished(
  session: Pick<SessionRow, "status" | "ends_at">,
  now: Date,
) {
  return (
    session.status === "completed" ||
    Date.parse(session.ends_at) <= now.getTime()
  );
}

function resolveStatus(
  session: SessionRow,
  checkIn: CheckInRow | undefined,
  now: Date,
): AttendanceDisplayStatus {
  if (checkIn) {
    return checkIn.status;
  }

  return isFinished(session, now) ? "unrecorded" : "pending";
}

function groupAttendance(
  entries: AttendanceEntry[],
  keyOf: (entry: AttendanceEntry) => string,
  labelOf: (entry: AttendanceEntry) => string,
  secondaryOf: (entry: AttendanceEntry) => string | null,
): AttendanceGroupSummary[] {
  const groups = new Map<
    string,
    {
      label: string;
      secondaryLabel: string | null;
      outcomes: AttendanceOutcome[];
    }
  >();

  for (const entry of entries) {
    const key = keyOf(entry);
    const group = groups.get(key);

    if (group) {
      group.outcomes.push(entry.status);
      continue;
    }

    groups.set(key, {
      label: labelOf(entry),
      secondaryLabel: secondaryOf(entry),
      outcomes: [entry.status],
    });
  }

  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      secondaryLabel: group.secondaryLabel,
      counts: summarizeAttendance(group.outcomes),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

/**
 * The student's own attendance.
 *
 * Scope is decided server-side: only classes the caller belongs to are
 * considered, and the check-in query is pinned to the caller's user id. A
 * session only counts after the student joined the class, so joining halfway
 * through a term does not invent absences for earlier meetings.
 */
export async function getStudentAttendance(
  userId: string,
  query: AttendanceQuery,
): Promise<StudentAttendanceView> {
  const now = new Date();
  const classes = await listMyClasses(userId);
  const memberships = new Map<string, MembershipInfo>(
    classes.map((classItem) => [
      classItem.id,
      {
        id: classItem.id,
        slug: classItem.slug,
        name: classItem.name,
        course_name: classItem.course_name,
        semester: classItem.semester,
        academic_year: classItem.academic_year,
        joined_at: classItem.joined_at,
      },
    ]),
  );
  const classIds = [...memberships.keys()];

  const options: AttendanceFilterOptions = {
    classes: classes.map((classItem) => ({
      id: classItem.id,
      name: classItem.name,
      slug: classItem.slug,
      semester: classItem.semester,
      academicYear: classItem.academic_year,
    })),
    subjects: [],
    academicYears: [...new Set(classes.map((c) => c.academic_year))].sort(
      (left, right) => right.localeCompare(left),
    ),
    semesters: [...new Set(classes.map((c) => c.semester))].sort(
      (left, right) => left.localeCompare(right),
    ),
  };

  if (classIds.length === 0) {
    return emptyView(options);
  }

  const supabase = await createSupabaseServerClient();

  const subjectsPromise = supabase
    .from("class_subjects")
    .select("id, class_id, name, code")
    .in("class_id", classIds)
    .order("name", { ascending: true })
    .limit(1_000);

  const sessionsPromise = supabase
    .from("discussion_sessions")
    .select(
      "id, class_id, assignment_id, subject_id, title, session_type, location, starts_at, ends_at, time_zone, status",
    )
    .in("class_id", classIds)
    .neq("status", "cancelled")
    .lte("starts_at", now.toISOString())
    .order("starts_at", { ascending: false })
    .limit(MAX_SESSIONS);

  const [subjectsResult, sessionsResult] = await Promise.all([
    subjectsPromise,
    sessionsPromise,
  ]);

  if (subjectsResult.error) {
    throw new DataAccessError(
      "Could not load class subjects",
      subjectsResult.error.code,
    );
  }

  if (sessionsResult.error) {
    throw new DataAccessError(
      "Could not load your sessions",
      sessionsResult.error.code,
    );
  }

  const subjects = subjectsResult.data ?? [];
  const subjectById = new Map(subjects.map((row) => [row.id, row]));
  options.subjects = subjects.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    classId: row.class_id,
    className: memberships.get(row.class_id)?.name ?? "Unknown class",
  }));

  const sessions = (sessionsResult.data ?? []) as SessionRow[];

  if (sessions.length === 0) {
    return emptyView(options);
  }

  const assignmentIds = [
    ...new Set(
      sessions.flatMap((session) =>
        session.assignment_id ? [session.assignment_id] : [],
      ),
    ),
  ];

  const checkInsResult = await supabase
    .from("discussion_session_checkins")
    .select(
      "session_id, status, method, checked_in_at, note, reviewed_by, reviewed_at",
    )
    .eq("user_id", userId)
    .in(
      "session_id",
      sessions.map((session) => session.id),
    )
    .limit(MAX_SESSIONS);

  if (checkInsResult.error) {
    throw new DataAccessError(
      "Could not load your attendance records",
      checkInsResult.error.code,
    );
  }

  let assignments: { id: string; subject_id: string | null }[] = [];

  if (assignmentIds.length > 0) {
    const assignmentsResult = await supabase
      .from("assignments")
      .select("id, subject_id")
      .in("id", assignmentIds)
      .limit(MAX_SESSIONS);

    if (assignmentsResult.error) {
      throw new DataAccessError(
        "Could not load the linked subjects",
        assignmentsResult.error.code,
      );
    }

    assignments = assignmentsResult.data ?? [];
  }

  const checkInBySession = new Map(
    (checkInsResult.data ?? []).map((row) => [
      row.session_id,
      row as CheckInRow,
    ]),
  );
  const subjectIdByAssignment = new Map(
    assignments.flatMap((row) =>
      row.subject_id ? [[row.id, row.subject_id] as const] : [],
    ),
  );

  const reviewerIds = (checkInsResult.data ?? []).flatMap((row) =>
    row.reviewed_by ? [row.reviewed_by] : [],
  );
  const reviewers = await loadProfiles(reviewerIds);

  const entries: AttendanceEntry[] = sessions.flatMap((session) => {
    const membership = memberships.get(session.class_id);

    if (!membership) {
      return [];
    }

    // Sessions before the student joined are not their history.
    if (Date.parse(session.starts_at) < Date.parse(membership.joined_at)) {
      return [];
    }

    const checkIn = checkInBySession.get(session.id);
    // Attendance meetings carry their course directly; older sessions only
    // reach a course through their assignment.
    const subjectId =
      session.subject_id ??
      (session.assignment_id
        ? (subjectIdByAssignment.get(session.assignment_id) ?? null)
        : null);
    const reviewer = checkIn?.reviewed_by
      ? reviewers.get(checkIn.reviewed_by)
      : undefined;

    return [
      {
        sessionId: session.id,
        classId: session.class_id,
        classSlug: membership.slug,
        className: membership.name,
        courseName: membership.course_name,
        academicYear: membership.academic_year,
        semester: membership.semester,
        subjectId,
        subjectName: subjectId
          ? (subjectById.get(subjectId)?.name ?? null)
          : null,
        title: session.title,
        sessionType: session.session_type,
        location: session.location,
        startsAt: session.starts_at,
        endsAt: session.ends_at,
        timeZone: session.time_zone,
        dateKey: toJakartaDateKey(session.starts_at),
        status: resolveStatus(session, checkIn, now),
        checkedInAt: checkIn?.checked_in_at ?? null,
        method: checkIn?.method ?? null,
        note: checkIn?.note ?? null,
        reviewedAt: checkIn?.reviewed_at ?? null,
        recordedByName: reviewer?.display_name ?? null,
      },
    ];
  });

  const scoped = entries.filter(
    (entry) =>
      (!query.class || entry.classId === query.class) &&
      (!query.subject || entry.subjectId === query.subject) &&
      (!query.year || entry.academicYear === query.year) &&
      (!query.semester || entry.semester === query.semester) &&
      (!query.from || entry.dateKey >= query.from) &&
      (!query.to || entry.dateKey <= query.to),
  );

  const visible =
    query.status === "all"
      ? scoped
      : scoped.filter((entry) => entry.status === query.status);

  return {
    summary: summarizeAttendance(scoped.map((entry) => entry.status)),
    entries: visible,
    scopedTotal: scoped.length,
    byClass: groupAttendance(
      scoped,
      (entry) => entry.classId,
      (entry) => entry.className,
      (entry) => `${entry.academicYear} · ${entry.semester}`,
    ),
    bySubject: groupAttendance(
      scoped,
      (entry) => entry.subjectId ?? `${entry.classId}:none`,
      (entry) => entry.subjectName ?? "No linked subject",
      (entry) => entry.className,
    ),
    options,
  };
}

type CheckInCandidateRow = {
  id: string;
  class_id: string;
  assignment_id: string | null;
  subject_id: string | null;
  organizer_id: string;
  title: string;
  session_type: SessionType;
  location: string | null;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  status: SessionStatusRow;
};

type ViewerCheckInRow = {
  session_id: string;
  status: AttendanceCheckInStatus;
  checked_in_at: string;
  distance_m: number | null;
};

type CheckInSummaryRow = {
  session_id: string;
  has_location: boolean;
  radius_m: number;
};

const CHECK_IN_SESSION_COLUMNS =
  "id, class_id, assignment_id, subject_id, organizer_id, title, session_type, location, starts_at, ends_at, time_zone, status";

function emptyCheckInView(
  todayDateKey: string,
  hasClasses: boolean,
): AttendanceCheckInView {
  return {
    hasClasses,
    todayDateKey,
    today: { present: 0, late: 0, notCheckedIn: 0 },
    activeSessions: [],
  };
}

export type AttendanceCheckInScope = {
  /** Restricts the view to one class, used by the class workspace tab. */
  classId?: string;
};

/**
 * The check-in-first view of `/attendance`.
 *
 * Only classes the caller actively belongs to are considered. A session appears
 * as an active card when it is scheduled, in person, has a saved room point,
 * and its check-in window is open right now. The database still re-checks every
 * one of those conditions when the student actually checks in.
 */
export async function getAttendanceCheckInView(
  userId: string,
  now: Date = new Date(),
  scope: AttendanceCheckInScope = {},
): Promise<AttendanceCheckInView> {
  const todayDateKey = toJakartaDateKey(now);
  const nowMs = now.getTime();
  const dayStart = new Date(`${todayDateKey}T00:00:00${APP_TIME_ZONE_OFFSET}`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const allClasses = await listMyClasses(userId);
  const classes = scope.classId
    ? allClasses.filter((classItem) => classItem.id === scope.classId)
    : allClasses;
  const activeClasses = classes.filter(
    (classItem) => classItem.status === "active",
  );

  if (activeClasses.length === 0) {
    return emptyCheckInView(todayDateKey, classes.length > 0);
  }

  const membershipById = new Map(
    activeClasses.map((classItem) => [classItem.id, classItem]),
  );
  const classIds = [...membershipById.keys()];
  const supabase = await createSupabaseServerClient();

  const [activeResult, todayResult] = await Promise.all([
    supabase
      .from("discussion_sessions")
      .select(CHECK_IN_SESSION_COLUMNS)
      .in("class_id", classIds)
      .eq("status", "scheduled")
      .eq("session_type", "in_person")
      .is("meeting_number", null)
      .gte("ends_at", now.toISOString())
      .lte("starts_at", new Date(nowMs + SESSION_CHECKIN_LEAD_MS).toISOString())
      .order("starts_at", { ascending: true })
      .limit(50),
    supabase
      .from("discussion_sessions")
      .select(CHECK_IN_SESSION_COLUMNS)
      .in("class_id", classIds)
      .eq("session_type", "in_person")
      .neq("status", "cancelled")
      .is("meeting_number", null)
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .order("starts_at", { ascending: true })
      .limit(50),
  ]);

  if (activeResult.error) {
    throw new DataAccessError(
      "Could not load active attendance sessions",
      activeResult.error.code,
    );
  }

  if (todayResult.error) {
    throw new DataAccessError(
      "Could not load today's attendance",
      todayResult.error.code,
    );
  }

  const candidatesById = new Map<string, CheckInCandidateRow>();

  for (const row of [
    ...((activeResult.data ?? []) as CheckInCandidateRow[]),
    ...((todayResult.data ?? []) as CheckInCandidateRow[]),
  ]) {
    if (!candidatesById.has(row.id)) {
      candidatesById.set(row.id, row);
    }
  }

  const candidates = [...candidatesById.values()].filter((session) => {
    const membership = membershipById.get(session.class_id);

    return (
      membership !== undefined &&
      Date.parse(session.starts_at) >= Date.parse(membership.joined_at)
    );
  });

  if (candidates.length === 0) {
    return emptyCheckInView(todayDateKey, true);
  }

  // The raw point is not granted to clients, so ask the batched helper once.
  // Today's active set is small, but avoiding an RPC per candidate keeps this
  // list cheap when a day has many openings.
  const { data: settingsData, error: settingsError } = await supabase.rpc(
    "session_checkin_summary_many",
    { p_session_ids: candidates.map((session) => session.id) },
  );
  const summaryById = new Map<string, CheckInSummaryRow>();

  if (settingsError) {
    throw new DataAccessError(
      "Could not load the check-in settings",
      settingsError.code,
    );
  }

  for (const summary of (settingsData ?? []) as CheckInSummaryRow[]) {
    summaryById.set(summary.session_id, summary);
  }

  const withLocation = candidates.filter(
    (session) => summaryById.get(session.id)?.has_location === true,
  );

  if (withLocation.length === 0) {
    return emptyCheckInView(todayDateKey, true);
  }

  const sessionIds = withLocation.map((session) => session.id);
  const checkInsResult = await supabase
    .from("discussion_session_checkins")
    .select("session_id, status, checked_in_at, distance_m")
    .eq("user_id", userId)
    .in("session_id", sessionIds)
    .limit(MAX_SESSIONS);

  if (checkInsResult.error) {
    throw new DataAccessError(
      "Could not load your check-ins",
      checkInsResult.error.code,
    );
  }

  const checkInBySession = new Map(
    ((checkInsResult.data ?? []) as ViewerCheckInRow[]).map((row) => [
      row.session_id,
      row,
    ]),
  );

  const organizerIds = [
    ...new Set(withLocation.map((session) => session.organizer_id)),
  ];
  const organizerProfiles = await loadProfiles(organizerIds);

  const assignmentIds = [
    ...new Set(
      withLocation.flatMap((session) =>
        session.assignment_id ? [session.assignment_id] : [],
      ),
    ),
  ];
  const subjectIdByAssignment = new Map<string, string>();

  if (assignmentIds.length > 0) {
    const assignmentsResult = await supabase
      .from("assignments")
      .select("id, subject_id")
      .in("id", assignmentIds)
      .limit(MAX_SESSIONS);

    if (assignmentsResult.error) {
      throw new DataAccessError(
        "Could not load the linked subjects",
        assignmentsResult.error.code,
      );
    }

    for (const row of assignmentsResult.data ?? []) {
      if (row.subject_id) {
        subjectIdByAssignment.set(row.id, row.subject_id);
      }
    }
  }

  const subjectIds = [
    ...new Set([
      ...withLocation.flatMap((session) =>
        session.subject_id ? [session.subject_id] : [],
      ),
      ...subjectIdByAssignment.values(),
    ]),
  ];
  const subjectNameById = new Map<string, string>();

  if (subjectIds.length > 0) {
    const subjectsResult = await supabase
      .from("class_subjects")
      .select("id, name")
      .in("id", subjectIds)
      .limit(MAX_SESSIONS);

    if (subjectsResult.error) {
      throw new DataAccessError(
        "Could not load class subjects",
        subjectsResult.error.code,
      );
    }

    for (const row of subjectsResult.data ?? []) {
      subjectNameById.set(row.id, row.name);
    }
  }

  const activeSessions = withLocation
    .filter(
      (session) =>
        getSessionCheckInWindowState(
          session.starts_at,
          session.ends_at,
          nowMs,
        ) === "open",
    )
    .sort(
      (left, right) => Date.parse(left.starts_at) - Date.parse(right.starts_at),
    )
    .flatMap((session): ActiveAttendanceSession[] => {
      const membership = membershipById.get(session.class_id);

      if (!membership) {
        return [];
      }

      // Attendance meetings carry their course directly; older sessions only
      // reach a course through their assignment.
      const subjectId =
        session.subject_id ??
        (session.assignment_id
          ? (subjectIdByAssignment.get(session.assignment_id) ?? null)
          : null);
      const checkIn = checkInBySession.get(session.id);
      const summary = summaryById.get(session.id);

      return [
        {
          sessionId: session.id,
          classId: session.class_id,
          classSlug: membership.slug,
          className: membership.name,
          classCode: membership.class_code,
          courseName: membership.course_name,
          semester: membership.semester,
          subjectId,
          subjectName: subjectId
            ? (subjectNameById.get(subjectId) ?? null)
            : null,
          title: session.title,
          organizerName:
            organizerProfiles.get(session.organizer_id)?.display_name ??
            "Class admin",
          sessionType: session.session_type,
          location: session.location,
          startsAt: session.starts_at,
          endsAt: session.ends_at,
          timeZone: session.time_zone,
          radiusM: summary?.radius_m ?? 150,
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

  const today = summarizeCheckInDay(
    withLocation
      .filter((session) => toJakartaDateKey(session.starts_at) === todayDateKey)
      .map((session) => {
        const window = getSessionCheckInWindow(
          session.starts_at,
          session.ends_at,
        );

        return {
          opensAt: window
            ? new Date(window.opensAt).toISOString()
            : session.starts_at,
          closesAt: window
            ? new Date(window.closesAt).toISOString()
            : session.ends_at,
          status: checkInBySession.get(session.id)?.status ?? null,
        };
      }),
    nowMs,
  );

  return {
    hasClasses: true,
    todayDateKey,
    today,
    activeSessions,
  };
}

/**
 * One session for the detail page.
 *
 * Returns null unless the caller is still a member of the session's class, so a
 * guessed session id cannot expose another class's attendance to a student.
 */
export async function getStudentAttendanceEntry(
  sessionId: string,
  userId: string,
): Promise<AttendanceEntry | null> {
  const supabase = await createSupabaseServerClient();
  const now = new Date();

  const { data: session, error } = await supabase
    .from("discussion_sessions")
    .select(
      "id, class_id, assignment_id, subject_id, title, session_type, location, starts_at, ends_at, time_zone, status",
    )
    .eq("id", sessionId)
    .maybeSingle<SessionRow>();

  if (error) {
    throw new DataAccessError("Could not load the session", error.code);
  }

  if (!session) {
    return null;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("class_members")
    .select("joined_at")
    .eq("class_id", session.class_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    throw new DataAccessError(
      "Could not check class membership",
      membershipError.code,
    );
  }

  if (!membership) {
    return null;
  }

  if (Date.parse(session.starts_at) < Date.parse(membership.joined_at)) {
    return null;
  }

  const classResult = await supabase
    .from("classes")
    .select("slug, name, course_name, semester, academic_year")
    .eq("id", session.class_id)
    .maybeSingle();

  if (classResult.error) {
    throw new DataAccessError(
      "Could not load the class",
      classResult.error.code,
    );
  }

  const checkInResult = await supabase
    .from("discussion_session_checkins")
    .select(
      "session_id, status, method, checked_in_at, note, reviewed_by, reviewed_at",
    )
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (checkInResult.error) {
    throw new DataAccessError(
      "Could not load the attendance record",
      checkInResult.error.code,
    );
  }

  if (!classResult.data) {
    return null;
  }

  const classRow = classResult.data;
  let subjectId: string | null = session.subject_id;

  if (!subjectId && session.assignment_id) {
    const subjectResult = await supabase
      .from("assignments")
      .select("subject_id")
      .eq("id", session.assignment_id)
      .maybeSingle();

    if (subjectResult.error) {
      throw new DataAccessError(
        "Could not load the linked subject",
        subjectResult.error.code,
      );
    }

    subjectId = subjectResult.data?.subject_id ?? null;
  }

  let subjectName: string | null = null;

  if (subjectId) {
    const { data: subject, error: subjectError } = await supabase
      .from("class_subjects")
      .select("name")
      .eq("id", subjectId)
      .maybeSingle();

    if (subjectError) {
      throw new DataAccessError(
        "Could not load the subject",
        subjectError.code,
      );
    }

    subjectName = subject?.name ?? null;
  }

  const checkIn = checkInResult.data as CheckInRow | null;
  const reviewers = checkIn?.reviewed_by
    ? await loadProfiles([checkIn.reviewed_by])
    : null;

  return {
    sessionId: session.id,
    classId: session.class_id,
    classSlug: classRow.slug,
    className: classRow.name,
    courseName: classRow.course_name,
    academicYear: classRow.academic_year,
    semester: classRow.semester,
    subjectId,
    subjectName,
    title: session.title,
    sessionType: session.session_type,
    location: session.location,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    timeZone: session.time_zone,
    dateKey: toJakartaDateKey(session.starts_at),
    status: resolveStatus(session, checkIn ?? undefined, now),
    checkedInAt: checkIn?.checked_in_at ?? null,
    method: checkIn?.method ?? null,
    note: checkIn?.note ?? null,
    reviewedAt: checkIn?.reviewed_at ?? null,
    recordedByName: checkIn?.reviewed_by
      ? (reviewers?.get(checkIn.reviewed_by)?.display_name ?? null)
      : null,
  };
}

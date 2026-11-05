import "server-only";

import type {
  CalendarEventType,
  CalendarQuery,
  OfficialCalendarEventType,
} from "@starstask/contracts";
import { LEAVE_REASON_LABELS } from "@starstask/contracts";
import {
  APP_TIME_ZONE_OFFSET,
  calendarEventDateKey,
  dateSpanOverlapsWindow,
  expandWeeklyScheduleForDays,
  type CalendarRange,
} from "@starstask/shared";

import { loadCompletionIds } from "@/lib/db/assignment-completions";
import { DataAccessError } from "@/lib/db/assignments";
import { listMyClasses } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CalendarEventStatus = "published" | "cancelled";

export type CalendarEventOwner =
  "official" | "assignment" | "personal" | "absence";

/**
 * One dated thing on the calendar, whichever source it came from.
 *
 * `assignment` and `class_schedule` rows that come from the assignment system,
 * discussion sessions, or the recurring timetable are read-only here. Official
 * events and personal events can be edited from the schedule page.
 */
export type CalendarEvent = {
  /** Unique per occurrence, because a weekly slot repeats every week. */
  key: string;
  sourceId: string;
  eventType: Exclude<CalendarEventType, "all">;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  classId: string | null;
  className: string | null;
  classSlug: string | null;
  subjectId: string | null;
  subjectName: string | null;
  status: CalendarEventStatus;
  owner: CalendarEventOwner;
  href: string | null;
  /** The row can be edited in a dialog on the schedule page. */
  editable: boolean;
  /** A recurring timetable slot; it is edited on its class page. */
  managedInClass: boolean;
};

export type CalendarClassOption = {
  id: string;
  slug: string;
  name: string;
  isAdmin: boolean;
};

export type CalendarSubjectOption = {
  id: string;
  classId: string;
  name: string;
  code: string | null;
  courseId: string | null;
  courseName: string | null;
  courseCode: string | null;
};

export type CalendarAssignmentBar = {
  id: string;
  title: string;
  /** YYYY-MM-DD in Asia/Jakarta. */
  startKey: string;
  /** YYYY-MM-DD in Asia/Jakarta. */
  endKey: string;
  href: string;
  classId: string | null;
  className: string | null;
  classSlug: string | null;
  /** Stable identity for colouring: catalog course when there is one. */
  courseKey: string | null;
  courseName: string | null;
  courseCode: string | null;
  isMine: boolean;
  isCompleted: boolean;
};

export type CalendarData = {
  events: CalendarEvent[];
  /** Assignments as span bars (created -> deadline), clipped by the window. */
  assignments: CalendarAssignmentBar[];
  classes: CalendarClassOption[];
  subjects: CalendarSubjectOption[];
  /** False until the calendar migration has been applied to this database. */
  storageReady: boolean;
};

type ClassLookup = {
  name: string;
  slug: string;
  isAdmin: boolean;
};

const EVENT_LIMIT = 500;

function matchesType(
  query: CalendarQuery,
  eventType: Exclude<CalendarEventType, "all">,
): boolean {
  return query.type === "all" || query.type === eventType;
}

function isOfficialType(value: string): value is OfficialCalendarEventType {
  return (
    value === "class_schedule" || value === "exam" || value === "academic_event"
  );
}

/**
 * Loads every event that belongs in the visible window for one viewer.
 *
 * Membership scoping happens before the queries: only classes the viewer
 * belongs to are ever placed in the `in` list, and RLS repeats the check in the
 * database. Assignment deadlines and discussion sessions are read from their
 * own tables, never copied into a calendar table, so an edit upstream is
 * reflected on the next render.
 */
export async function listCalendarEvents(
  userId: string,
  query: CalendarQuery,
  range: CalendarRange,
): Promise<CalendarData> {
  const memberships = (await listMyClasses(userId)).filter(
    (item) => item.status === "active",
  );

  const classes: CalendarClassOption[] = memberships.map((item) => ({
    id: item.id,
    slug: item.slug,
    name: item.name,
    isAdmin: item.is_admin,
  }));

  const classLookup = new Map<string, ClassLookup>(
    classes.map((item) => [
      item.id,
      { name: item.name, slug: item.slug, isAdmin: item.isAdmin },
    ]),
  );

  const allowedClassIds = classes.map((item) => item.id);
  const scopedClassIds = query.class
    ? allowedClassIds.filter((id) => id === query.class)
    : allowedClassIds;

  const supabase = await createSupabaseServerClient();

  const subjectsResult =
    allowedClassIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("class_subjects")
          .select("id, class_id, name, code, course_id")
          .in("class_id", allowedClassIds)
          .eq("status", "active")
          .order("name", { ascending: true })
          .limit(EVENT_LIMIT);

  if (subjectsResult.error) {
    throw new DataAccessError(
      "Could not load calendar subjects",
      subjectsResult.error.code,
    );
  }

  const subjectRows = subjectsResult.data ?? [];
  const subjectCourseIds = [
    ...new Set(
      subjectRows
        .map((row) => row.course_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const includeAssignments = matchesType(query, "assignment");
  // Published assignments in the caller's classes, plus published class-less
  // ones whose catalog course backs one of those classes' subjects. The
  // class page already shows the latter; the calendar stays consistent with
  // it and never widens what a member can read.
  const assignmentScope = [
    scopedClassIds.length > 0
      ? `class_id.in.(${scopedClassIds.join(",")})`
      : null,
    subjectCourseIds.length > 0
      ? `and(class_id.is.null,course_id.in.(${subjectCourseIds.join(",")}))`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(",");
  const includeSessions =
    matchesType(query, "class_schedule") && scopedClassIds.length > 0;
  const includeTimetable =
    matchesType(query, "class_schedule") && scopedClassIds.length > 0;
  const includeOfficial =
    (query.type === "all" ||
      query.type === "class_schedule" ||
      query.type === "exam" ||
      query.type === "academic_event") &&
    scopedClassIds.length > 0;
  // Personal events carry no class or subject, so either filter excludes them.
  const includePersonal =
    matchesType(query, "personal") && !query.subject && !query.class;
  // Absence notifications belong to a class but carry no subject, so only a
  // subject filter excludes them.
  const includeAbsence =
    matchesType(query, "absence") &&
    !query.subject &&
    scopedClassIds.length > 0;

  // Sessions and personal events carry no subject, so a subject filter
  // excludes them rather than guessing a match.
  const subjectFilter = query.subject;

  const [
    assignmentsResult,
    sessionsResult,
    officialResult,
    personalResult,
    absenceResult,
    timetableResult,
  ] = await Promise.all([
    includeAssignments && assignmentScope.length > 0
      ? (() => {
          let builder = supabase
            .from("assignments")
            .select(
              "id, title, deadline, class_id, subject_id, created_at, course_id, user_id",
            )
            .eq("status", "published")
            .not("deadline", "is", null)
            // Started before the window ends and not yet past its deadline
            // by the window start: overlapping spans must stay visible.
            .gte("deadline", range.fromIso)
            .lt("created_at", range.toIso)
            .or(assignmentScope)
            .order("deadline", { ascending: true })
            .limit(EVENT_LIMIT);

          if (subjectFilter) {
            builder = builder.eq("subject_id", subjectFilter);
          }

          return builder;
        })()
      : null,
    includeSessions && !subjectFilter
      ? supabase
          .from("discussion_sessions")
          .select("id, title, starts_at, ends_at, location, class_id, status")
          .in("class_id", scopedClassIds)
          .in("status", ["scheduled", "cancelled"])
          .gte("starts_at", range.fromIso)
          .lt("starts_at", range.toIso)
          .order("starts_at", { ascending: true })
          .limit(EVENT_LIMIT)
      : null,
    includeOfficial
      ? (() => {
          let builder = supabase
            .from("class_calendar_events")
            .select(
              "id, class_id, subject_id, title, description, event_type, starts_at, ends_at, location, status",
            )
            .in("class_id", scopedClassIds)
            .in("status", ["published", "cancelled"])
            .lt("starts_at", range.toIso)
            .gt("ends_at", range.fromIso)
            .order("starts_at", { ascending: true })
            .limit(EVENT_LIMIT);

          if (subjectFilter) {
            builder = builder.eq("subject_id", subjectFilter);
          }

          return builder;
        })()
      : null,
    includePersonal && !subjectFilter
      ? supabase
          .from("personal_calendar_events")
          .select(
            "id, title, description, starts_at, ends_at, location, status",
          )
          .eq("user_id", userId)
          .in("status", ["published", "cancelled"])
          .lt("starts_at", range.toIso)
          .gt("ends_at", range.fromIso)
          .order("starts_at", { ascending: true })
          .limit(EVENT_LIMIT)
      : null,
    includeAbsence
      ? supabase
          .from("leave_requests")
          .select(
            "id, reference, class_id, leave_start_date, leave_end_date, reason_category, status",
          )
          .eq("student_id", userId)
          // A rejected absence did not happen, so it is not shown as a calendar
          // entry. Pending and approved requests both occupy the dates.
          .in("status", ["submitted", "approved", "forwarded", "cancelled"])
          .in("class_id", scopedClassIds)
          .not("leave_start_date", "is", null)
          .order("leave_start_date", { ascending: false })
          .limit(EVENT_LIMIT)
      : null,
    includeTimetable
      ? (() => {
          let builder = supabase
            .from("class_course_schedules")
            .select(
              "id, class_id, subject_id, day_of_week, start_time, end_time, room",
            )
            .in("class_id", scopedClassIds)
            .limit(EVENT_LIMIT);

          if (subjectFilter) {
            builder = builder.eq("subject_id", subjectFilter);
          }

          return builder;
        })()
      : null,
  ]);

  const results = [
    {
      result: assignmentsResult,
      message: "Could not load assignment deadlines",
    },
    { result: sessionsResult, message: "Could not load class sessions" },
    { result: officialResult, message: "Could not load official events" },
    { result: personalResult, message: "Could not load your personal events" },
    { result: absenceResult, message: "Could not load your absence requests" },
    { result: timetableResult, message: "Could not load the weekly timetable" },
  ];

  const missingTable = (result: { error: { code: string } | null } | null) =>
    Boolean(
      result?.error &&
      (result.error.code === "42P01" || result.error.code === "PGRST205"),
    );

  const storageReady =
    !missingTable(officialResult) && !missingTable(personalResult);

  for (const entry of results) {
    if (!entry.result?.error) {
      continue;
    }

    // A migration that has not been applied yet must not take the rest of the
    // calendar down; the page shows a deployment warning instead.
    if (missingTable(entry.result)) {
      continue;
    }

    throw new DataAccessError(entry.message, entry.result.error.code);
  }

  const courseIdsToLoad = [
    ...new Set([
      ...subjectCourseIds,
      ...(assignmentsResult?.data ?? []).map((row) => row.course_id),
    ]),
  ];
  const courseResult =
    courseIdsToLoad.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("courses")
          .select("id, name, code")
          .in("id", courseIdsToLoad)
          .limit(EVENT_LIMIT);

  if (courseResult.error) {
    throw new DataAccessError(
      "Could not load course details",
      courseResult.error.code,
    );
  }

  type CatalogCourse = { name: string; code: string | null };
  const courseCatalog = new Map<string, CatalogCourse>(
    (courseResult.data ?? []).map((row) => [
      row.id,
      { name: row.name, code: row.code },
    ]),
  );

  const subjects: CalendarSubjectOption[] = subjectRows.map((row) => {
    const catalog = row.course_id
      ? courseCatalog.get(row.course_id)
      : undefined;

    return {
      id: row.id,
      classId: row.class_id,
      name: row.name,
      code: row.code ?? catalog?.code ?? null,
      courseId: row.course_id,
      courseName: catalog?.name ?? null,
      courseCode: catalog?.code ?? null,
    };
  });

  const subjectLookup = new Map(
    subjects.map((subject) => [subject.id, subject]),
  );

  const completions = await loadCompletionIds(
    userId,
    (assignmentsResult?.data ?? []).map((row) => row.id),
  );

  const assignments: CalendarAssignmentBar[] = [];

  for (const row of assignmentsResult?.data ?? []) {
    if (!row.deadline || !row.created_at) {
      continue;
    }

    const subject = row.subject_id
      ? subjectLookup.get(row.subject_id)
      : undefined;
    const catalog = subject?.courseId
      ? courseCatalog.get(subject.courseId)
      : courseCatalog.get(row.course_id);

    assignments.push({
      id: row.id,
      title: row.title,
      startKey: calendarEventDateKey(row.created_at),
      endKey: calendarEventDateKey(row.deadline),
      href: `/assignments/${row.id}`,
      classId: row.class_id,
      className: row.class_id
        ? (classLookup.get(row.class_id)?.name ?? null)
        : null,
      classSlug: row.class_id
        ? (classLookup.get(row.class_id)?.slug ?? null)
        : null,
      courseKey: subject?.courseId ?? row.course_id ?? row.subject_id ?? null,
      courseName: subject?.name ?? catalog?.name ?? null,
      courseCode: subject?.code ?? catalog?.code ?? null,
      isMine: row.user_id === userId,
      isCompleted: completions.has(row.id),
    });
  }

  const events: CalendarEvent[] = [];

  const classFields = (classId: string) => {
    const found = classLookup.get(classId);

    return {
      classId,
      className: found?.name ?? null,
      classSlug: found?.slug ?? null,
    };
  };

  for (const row of sessionsResult?.data ?? []) {
    const fields = classFields(row.class_id);

    events.push({
      key: `session:${row.id}`,
      sourceId: row.id,
      eventType: "class_schedule",
      title: row.title,
      description: null,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      location: row.location,
      ...fields,
      subjectId: null,
      subjectName: null,
      status: row.status === "cancelled" ? "cancelled" : "published",
      owner: "official",
      href: `/sessions/${row.id}`,
      editable: false,
      managedInClass: false,
    });
  }

  for (const row of officialResult?.data ?? []) {
    if (!isOfficialType(row.event_type)) {
      continue;
    }

    const subject = row.subject_id
      ? subjectLookup.get(row.subject_id)
      : undefined;
    const fields = classFields(row.class_id);
    const isAdmin = classLookup.get(row.class_id)?.isAdmin ?? false;

    events.push({
      key: `official:${row.id}`,
      sourceId: row.id,
      eventType: row.event_type,
      title: row.title,
      description: row.description,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      location: row.location,
      ...fields,
      subjectId: row.subject_id,
      subjectName: subject?.name ?? null,
      status: row.status === "cancelled" ? "cancelled" : "published",
      owner: "official",
      href: null,
      editable: isAdmin,
      managedInClass: false,
    });
  }

  for (const row of personalResult?.data ?? []) {
    events.push({
      key: `personal:${row.id}`,
      sourceId: row.id,
      eventType: "personal",
      title: row.title,
      description: row.description,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      location: row.location,
      classId: null,
      className: null,
      classSlug: null,
      subjectId: null,
      subjectName: null,
      status: row.status === "cancelled" ? "cancelled" : "published",
      owner: "personal",
      href: null,
      editable: true,
      managedInClass: false,
    });
  }

  // Absence requests store calendar dates, not instants, so the overlap test
  // runs on `YYYY-MM-DD` keys and only then becomes a Jakarta-midnight instant.
  const window = { startKey: range.startKey, endKey: range.endKey };

  for (const row of absenceResult?.data ?? []) {
    if (
      !row.leave_start_date ||
      !dateSpanOverlapsWindow(row.leave_start_date, row.leave_end_date, window)
    ) {
      continue;
    }

    const endDate = row.leave_end_date ?? row.leave_start_date;
    const reason =
      row.reason_category && row.reason_category in LEAVE_REASON_LABELS
        ? LEAVE_REASON_LABELS[
            row.reason_category as keyof typeof LEAVE_REASON_LABELS
          ]
        : null;
    const fields = classFields(row.class_id);

    events.push({
      key: `absence:${row.id}`,
      sourceId: row.id,
      eventType: "absence",
      title: reason ? `Absence · ${reason}` : "Absence",
      description: row.reference,
      startsAt: `${row.leave_start_date}T00:00:00${APP_TIME_ZONE_OFFSET}`,
      endsAt: `${endDate}T23:59:59${APP_TIME_ZONE_OFFSET}`,
      location: null,
      ...fields,
      subjectId: null,
      subjectName: null,
      status: row.status === "cancelled" ? "cancelled" : "published",
      owner: "absence",
      href: `/leave-requests/${row.id}`,
      editable: false,
      managedInClass: false,
    });
  }

  const timetable = timetableResult?.data ?? [];
  const occurrences = expandWeeklyScheduleForDays(
    timetable,
    range.days.map((day) => day.dateKey),
  );

  for (const occurrence of occurrences) {
    const entry = occurrence.entry;
    const subject = subjectLookup.get(entry.subject_id);
    const fields = classFields(entry.class_id);

    events.push({
      key: `timetable:${entry.id}:${occurrence.dateKey}`,
      sourceId: entry.id,
      eventType: "class_schedule",
      title: subject?.name ?? "Class",
      description: null,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      location: entry.room,
      ...fields,
      subjectId: entry.subject_id,
      subjectName: subject?.name ?? null,
      status: "published",
      owner: "official",
      href: fields.classSlug ? `/app/classes/${fields.classSlug}` : null,
      editable: false,
      managedInClass: classLookup.get(entry.class_id)?.isAdmin ?? false,
    });
  }

  events.sort((left, right) => {
    const byStart = left.startsAt.localeCompare(right.startsAt);

    return byStart !== 0 ? byStart : left.title.localeCompare(right.title);
  });

  // Bars are emitted in deadline order already (the query orders by it); a
  // stable copy keeps the page independent of query order.
  const orderedAssignments = [...assignments].sort((left, right) => {
    const byEnd = left.endKey.localeCompare(right.endKey);

    return byEnd !== 0 ? byEnd : left.title.localeCompare(right.title);
  });

  return {
    events,
    assignments: orderedAssignments,
    classes,
    subjects,
    storageReady,
  };
}

/**
 * Confirms a class admin may attach a subject before writing an official event.
 * The API also checks the class role; this guards the subject relationship.
 */
export function findSubjectOption(
  subjects: CalendarSubjectOption[],
  classId: string,
  subjectId: string | undefined,
): CalendarSubjectOption | undefined {
  if (!subjectId) {
    return undefined;
  }

  return subjects.find(
    (subject) => subject.id === subjectId && subject.classId === classId,
  );
}

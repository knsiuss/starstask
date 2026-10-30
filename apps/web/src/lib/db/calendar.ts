import "server-only";

import type {
  CalendarEventType,
  CalendarQuery,
  OfficialCalendarEventType,
} from "@starstask/contracts";
import {
  expandWeeklyScheduleForDays,
  type CalendarRange,
} from "@starstask/shared";

import { DataAccessError } from "@/lib/db/assignments";
import { listMyClasses } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CalendarEventStatus = "published" | "cancelled";

export type CalendarEventOwner = "official" | "assignment" | "personal";

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
};

export type CalendarData = {
  events: CalendarEvent[];
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
          .select("id, class_id, name")
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

  const subjects: CalendarSubjectOption[] = (subjectsResult.data ?? []).map(
    (row) => ({ id: row.id, classId: row.class_id, name: row.name }),
  );

  const subjectLookup = new Map(
    subjects.map((subject) => [subject.id, subject]),
  );

  const includeAssignments = matchesType(query, "assignment");
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

  // Sessions and personal events carry no subject, so a subject filter
  // excludes them rather than guessing a match.
  const subjectFilter = query.subject;

  const [
    assignmentsResult,
    sessionsResult,
    officialResult,
    personalResult,
    timetableResult,
  ] = await Promise.all([
    includeAssignments
      ? (() => {
          let builder = supabase
            .from("assignments")
            .select("id, title, deadline, class_id, subject_id")
            .in("class_id", scopedClassIds)
            .eq("status", "published")
            .not("deadline", "is", null)
            .gte("deadline", range.fromIso)
            .lt("deadline", range.toIso)
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

  const events: CalendarEvent[] = [];

  const classFields = (classId: string) => {
    const found = classLookup.get(classId);

    return {
      classId,
      className: found?.name ?? null,
      classSlug: found?.slug ?? null,
    };
  };

  for (const row of assignmentsResult?.data ?? []) {
    if (!row.deadline || !row.class_id) {
      continue;
    }

    const subject = row.subject_id
      ? subjectLookup.get(row.subject_id)
      : undefined;
    const fields = classFields(row.class_id);

    events.push({
      key: `assignment:${row.id}`,
      sourceId: row.id,
      eventType: "assignment",
      title: row.title,
      description: null,
      startsAt: row.deadline,
      endsAt: null,
      location: null,
      ...fields,
      subjectId: row.subject_id,
      subjectName: subject?.name ?? null,
      status: "published",
      owner: "assignment",
      href: `/assignments/${row.id}`,
      editable: false,
      managedInClass: false,
    });
  }

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
      href: fields.classSlug ? `/dashboard/classes/${fields.classSlug}` : null,
      editable: false,
      managedInClass: classLookup.get(entry.class_id)?.isAdmin ?? false,
    });
  }

  events.sort((left, right) => {
    const byStart = left.startsAt.localeCompare(right.startsAt);

    return byStart !== 0 ? byStart : left.title.localeCompare(right.title);
  });

  return { events, classes, subjects, storageReady };
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

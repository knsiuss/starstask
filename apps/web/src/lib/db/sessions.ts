import "server-only";

import type {
  RsvpStatus,
  SessionListQuery,
  SessionStatus,
  SessionType,
  SessionVisibility,
} from "@starstask/contracts";

import { DataAccessError, type PaginatedResult } from "@/lib/db/assignments";
import { listMyClasses, loadProfiles } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionListRow } from "@/types/database";

export type SessionSummary = {
  id: string;
  classId: string;
  classSlug: string;
  className: string;
  assignmentId: string | null;
  organizerId: string;
  organizerName: string;
  organizerAvatarUrl: string | null;
  title: string;
  description: string;
  agenda: string | null;
  sessionType: SessionType;
  meetingUrl: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  capacity: number | null;
  registrationDeadline: string | null;
  visibility: SessionVisibility;
  status: SessionStatus;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  goingCount: number;
  maybeCount: number;
  viewerStatus: RsvpStatus | null;
};

/** A single session, plus the check-in details only its page needs. */
export type SessionDetail = SessionSummary & {
  /** Whether an organizer saved a point for location check-in. */
  hasCheckInLocation: boolean;
  checkinRadiusM: number;
};

export type SessionCheckIn = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  status: SessionCheckInStatus;
  method: SessionCheckInMethod;
  checkedInAt: string;
  accuracyM: number | null;
  distanceM: number | null;
  note: string | null;
  reviewedAt: string | null;
};

export type SessionCheckInStatus = "present" | "late" | "excused" | "absent";

export type SessionCheckInMethod = "geo" | "manual";

export type SessionParticipant = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  status: RsvpStatus;
  updatedAt: string;
};

export type SessionAttendance = {
  goingCount: number;
  maybeCount: number;
  notGoingCount: number;
  capacity: number | null;
  viewerStatus: RsvpStatus | null;
};

export type SessionClassOption = {
  id: string;
  slug: string;
  name: string;
  semester: string;
};

export type SessionAssignmentOption = {
  id: string;
  title: string;
};

const SESSION_COLUMNS =
  "id, class_id, assignment_id, organizer_id, title, description, agenda, session_type, meeting_url, location, starts_at, ends_at, time_zone, capacity, registration_deadline, visibility, status, cancelled_at, completed_at, created_at, updated_at, checkin_latitude, checkin_longitude, checkin_radius_m";

type SessionRow = {
  id: string;
  class_id: string;
  assignment_id: string | null;
  organizer_id: string;
  title: string;
  description: string;
  agenda: string | null;
  session_type: SessionType;
  meeting_url: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  capacity: number | null;
  registration_deadline: string | null;
  visibility: SessionVisibility;
  status: SessionStatus;
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  checkin_latitude: number | null;
  checkin_longitude: number | null;
  checkin_radius_m: number;
};

function mapListRow(row: SessionListRow): SessionSummary {
  return {
    id: row.id,
    classId: row.class_id,
    classSlug: row.class_slug,
    className: row.class_name,
    assignmentId: row.assignment_id,
    organizerId: row.organizer_id,
    organizerName: row.organizer_display_name,
    organizerAvatarUrl: row.organizer_avatar_url,
    title: row.title,
    description: row.description,
    agenda: row.agenda,
    sessionType: row.session_type,
    meetingUrl: row.meeting_url,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timeZone: row.time_zone,
    capacity: row.capacity,
    registrationDeadline: row.registration_deadline,
    visibility: row.visibility,
    status: row.status,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    goingCount: Number(row.going_count),
    maybeCount: Number(row.maybe_count),
    viewerStatus: row.viewer_status,
  };
}

/**
 * Lists sessions visible to the caller.
 *
 * The RPC re-checks `can_view_session` for every row, so passing another
 * class's id cannot widen the result. Attendance counts come back with the
 * rows, which keeps a 24-item list to a single round trip.
 */
export async function listSessions(
  query: SessionListQuery,
  options: { classId?: string | null } = {},
): Promise<PaginatedResult<SessionSummary>> {
  const supabase = await createSupabaseServerClient();
  const offset = (query.page - 1) * query.pageSize;

  const { data, error } = await supabase.rpc("list_discussion_sessions", {
    p_class_id: options.classId ?? query.class ?? null,
    p_status: query.status,
    p_type: query.type ?? null,
    p_from: query.from ?? null,
    p_to: query.to ?? null,
    p_limit: query.pageSize,
    p_offset: offset,
  });

  if (error) {
    throw new DataAccessError("Could not load sessions", error.code);
  }

  const rows = data ?? [];
  const total = Number(rows[0]?.total_count ?? 0);

  return {
    items: rows.map(mapListRow),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getSessionById(
  sessionId: string,
): Promise<SessionDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("discussion_sessions")
    .select(
      `${SESSION_COLUMNS},
       classes!discussion_sessions_class_id_fkey ( slug, name )`,
    )
    .eq("id", sessionId)
    .maybeSingle<
      SessionRow & { classes: { slug: string; name: string } | null }
    >();

  if (error) {
    throw new DataAccessError("Could not load the session", error.code);
  }

  if (!data) {
    return null;
  }

  const [attendance, profiles] = await Promise.all([
    getSessionAttendance(sessionId),
    loadProfiles([data.organizer_id]),
  ]);
  const organizer = profiles.get(data.organizer_id);

  return {
    id: data.id,
    classId: data.class_id,
    classSlug: data.classes?.slug ?? "",
    className: data.classes?.name ?? "Unknown class",
    assignmentId: data.assignment_id,
    organizerId: data.organizer_id,
    organizerName: organizer?.display_name ?? "StarsTask member",
    organizerAvatarUrl: organizer?.avatar_url ?? null,
    title: data.title,
    description: data.description,
    agenda: data.agenda,
    sessionType: data.session_type,
    meetingUrl: data.meeting_url,
    location: data.location,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    timeZone: data.time_zone,
    capacity: data.capacity,
    registrationDeadline: data.registration_deadline,
    visibility: data.visibility,
    status: data.status,
    cancelledAt: data.cancelled_at,
    completedAt: data.completed_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    goingCount: attendance.goingCount,
    maybeCount: attendance.maybeCount,
    viewerStatus: attendance.viewerStatus,
    hasCheckInLocation:
      data.checkin_latitude !== null && data.checkin_longitude !== null,
    checkinRadiusM: data.checkin_radius_m,
  };
}

/**
 * Attendance counts for one session. The function checks visibility itself, so
 * a caller that guesses an id still cannot read another class's numbers.
 */
export async function getSessionAttendance(
  sessionId: string,
): Promise<SessionAttendance> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("session_attendance", {
    p_session_id: sessionId,
  });

  if (error) {
    throw new DataAccessError("Could not load attendance", error.code);
  }

  const row = data?.[0];

  return {
    goingCount: Number(row?.going_count ?? 0),
    maybeCount: Number(row?.maybe_count ?? 0),
    notGoingCount: Number(row?.not_going_count ?? 0),
    capacity: row?.capacity ?? null,
    viewerStatus: row?.viewer_status ?? null,
  };
}

/**
 * Participant identities. RLS returns other people's rows only to a class
 * manager, so a non-manager silently gets their own row back; the UI shows the
 * list only when the caller may manage the class.
 */
export async function getSessionParticipants(
  sessionId: string,
): Promise<SessionParticipant[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("discussion_session_rsvps")
    .select("user_id, status, updated_at")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: true })
    .limit(500);

  if (error) {
    throw new DataAccessError("Could not load participants", error.code);
  }

  const profiles = await loadProfiles((data ?? []).map((row) => row.user_id));

  return (data ?? []).map((row) => ({
    userId: row.user_id,
    displayName: profiles.get(row.user_id)?.display_name ?? "StarsTask member",
    avatarUrl: profiles.get(row.user_id)?.avatar_url ?? null,
    status: row.status,
    updatedAt: row.updated_at,
  }));
}

/**
 * Check-ins visible to the caller. RLS returns only the caller's own row to a
 * participant, and every row of a session they run to an organizer.
 */
export async function getSessionCheckIns(
  sessionId: string,
): Promise<SessionCheckIn[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("discussion_session_checkins")
    .select(
      "id, user_id, status, method, checked_in_at, accuracy_m, distance_m, note, reviewed_at",
    )
    .eq("session_id", sessionId)
    .order("checked_in_at", { ascending: true })
    .limit(500);

  if (error) {
    throw new DataAccessError("Could not load attendance", error.code);
  }

  const profiles = await loadProfiles((data ?? []).map((row) => row.user_id));

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    displayName: profiles.get(row.user_id)?.display_name ?? "StarsTask member",
    avatarUrl: profiles.get(row.user_id)?.avatar_url ?? null,
    status: row.status,
    method: row.method,
    checkedInAt: row.checked_in_at,
    accuracyM: row.accuracy_m === null ? null : Number(row.accuracy_m),
    distanceM: row.distance_m === null ? null : Number(row.distance_m),
    note: row.note,
    reviewedAt: row.reviewed_at,
  }));
}

/**
 * Classes the caller may schedule sessions for. Platform admins see every
 * active class; everyone else sees only the classes they administer, which is
 * the same predicate the database enforces on write.
 */
export async function getManageableClassOptions(
  userId: string,
): Promise<SessionClassOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data: platformAdmin, error: adminError } = await supabase.rpc(
    "is_platform_admin",
    {},
  );

  if (adminError) {
    throw new DataAccessError("Could not resolve permissions", adminError.code);
  }

  if (platformAdmin === true) {
    const { data, error } = await supabase
      .from("classes")
      .select("id, slug, name, semester")
      .eq("status", "active")
      .order("name", { ascending: true })
      .limit(200);

    if (error) {
      throw new DataAccessError("Could not load classes", error.code);
    }

    return data ?? [];
  }

  const { data: adminRows, error: adminRowsError } = await supabase
    .from("class_admins")
    .select("class_id")
    .eq("user_id", userId)
    .limit(200);

  if (adminRowsError) {
    throw new DataAccessError(
      "Could not load your classes",
      adminRowsError.code,
    );
  }

  const classIds = (adminRows ?? []).map((row) => row.class_id);

  if (classIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("classes")
    .select("id, slug, name, semester")
    .in("id", classIds)
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(200);

  if (error) {
    throw new DataAccessError("Could not load your classes", error.code);
  }

  return data ?? [];
}

/** Published assignments of one class, for the optional session link. */
export async function getSessionAssignmentOptions(
  classId: string,
): Promise<SessionAssignmentOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("id, title")
    .eq("class_id", classId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new DataAccessError("Could not load assignments", error.code);
  }

  return data ?? [];
}

/**
 * Classes the caller belongs to, for the list filter.
 *
 * This is deliberately wider than `getManageableClassOptions`: a student filters
 * by the classes they can see, not by the ones they may schedule in.
 */
export async function getSessionClassFilterOptions(
  userId: string,
): Promise<SessionClassOption[]> {
  const classes = await listMyClasses(userId);

  return classes.map((classItem) => ({
    id: classItem.id,
    slug: classItem.slug,
    name: classItem.name,
    semester: classItem.semester,
  }));
}

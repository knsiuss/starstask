import "server-only";

import type {
  RsvpStatus,
  SessionCheckInInput,
  SessionCheckInLocationInput,
  SessionCheckInRecordInput,
  SessionCheckInReviewInput,
  SessionCheckInStatus,
  SessionCreateInput,
  SessionStatusUpdateInput,
  SessionUpdateInput,
} from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toSessionApiError } from "@/features/sessions/errors";

type RsvpResult = {
  status: RsvpStatus;
  goingCount: number;
  maybeCount: number;
  notGoingCount: number;
  capacity: number | null;
};

/**
 * Creates a session. Authorization is decided by the database function, which
 * re-checks `can_organize_class_sessions`; the route's own check is only for a
 * faster, friendlier error.
 */
export async function createSession(
  input: SessionCreateInput,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_discussion_session", {
    p_class_id: input.classId,
    p_title: input.title,
    p_description: input.description,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_time_zone: input.timeZone,
    p_session_type: input.sessionType,
    p_meeting_url: input.meetingUrl ?? null,
    p_location: input.location ?? null,
    p_agenda: input.agenda ?? null,
    p_capacity: input.capacity ?? null,
    p_registration_deadline: input.registrationDeadline ?? null,
    p_visibility: input.visibility,
    p_assignment_id: input.assignmentId ?? null,
  });

  if (error) {
    throw toSessionApiError(error, "Could not create the session.");
  }

  if (!data) {
    throw new ApiError(500, "internal_error", "Could not create the session.");
  }

  return data;
}

export async function updateSession(
  sessionId: string,
  input: SessionUpdateInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_discussion_session", {
    p_session_id: sessionId,
    p_title: input.title,
    p_description: input.description,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_time_zone: input.timeZone,
    p_session_type: input.sessionType,
    p_meeting_url: input.meetingUrl ?? null,
    p_location: input.location ?? null,
    p_agenda: input.agenda ?? null,
    p_capacity: input.capacity ?? null,
    p_registration_deadline: input.registrationDeadline ?? null,
    p_visibility: input.visibility,
    p_assignment_id: input.assignmentId ?? null,
  });

  if (error) {
    throw toSessionApiError(error, "Could not update the session.");
  }
}

export async function setSessionStatus(
  sessionId: string,
  input: SessionStatusUpdateInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_discussion_session_status", {
    p_session_id: sessionId,
    p_status: input.status,
  });

  if (error) {
    throw toSessionApiError(error, "Could not change the session status.");
  }
}

/**
 * Records the caller's RSVP.
 *
 * The function locks the session row, so the capacity check and the insert
 * cannot interleave with another request for the last seat.
 */
export async function rsvpSession(
  sessionId: string,
  status: RsvpStatus,
): Promise<RsvpResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rsvp_discussion_session", {
    p_session_id: sessionId,
    p_status: status,
  });

  if (error) {
    throw toSessionApiError(error, "Could not save your RSVP.");
  }

  const payload = isRecord(data) ? data : {};
  const saved = payload.status;

  return {
    status: isRsvpStatus(saved) ? saved : status,
    goingCount: readNumber(payload.going_count),
    maybeCount: readNumber(payload.maybe_count),
    notGoingCount: readNumber(payload.not_going_count),
    capacity: typeof payload.capacity === "number" ? payload.capacity : null,
  };
}

/** Removes the caller's RSVP; the function scopes the delete to auth.uid(). */
export async function cancelRsvp(sessionId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cancel_session_rsvp", {
    p_session_id: sessionId,
  });

  if (error) {
    throw toSessionApiError(error, "Could not cancel your RSVP.");
  }

  return data === true;
}

export type SessionCheckInResult = {
  id: string;
  status: SessionCheckInStatus;
  checkedInAt: string;
  distanceM: number;
  accuracyM: number;
  /** True when the request returned an existing row instead of inserting. */
  alreadyCheckedIn: boolean;
};

/**
 * Records the caller at a session.
 *
 * The database decides every rule: window, accuracy, distance, and membership.
 * A repeated request returns the first row instead of failing, so a retry after
 * a dropped response is safe.
 */
export async function checkInSession(
  sessionId: string,
  input: SessionCheckInInput,
): Promise<SessionCheckInResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("check_in_discussion_session", {
    p_session_id: sessionId,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_accuracy_m: input.accuracy,
  });

  if (error) {
    throw toSessionApiError(error, "Could not record your check-in.");
  }

  const payload = isRecord(data) ? data : {};
  const status = payload.status;

  if (!isCheckInStatus(status)) {
    throw new ApiError(
      500,
      "internal_error",
      "Could not record your check-in.",
    );
  }

  return {
    id: typeof payload.id === "string" ? payload.id : "",
    status,
    checkedInAt:
      typeof payload.checked_in_at === "string"
        ? payload.checked_in_at
        : new Date().toISOString(),
    distanceM: readNumber(payload.distance_m),
    accuracyM: readNumber(payload.accuracy_m),
    alreadyCheckedIn: payload.already_checked_in === true,
  };
}

/** Saves the room the organizer is standing in. Permission is re-checked in SQL. */
export async function setCheckInLocation(
  sessionId: string,
  input: SessionCheckInLocationInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "set_discussion_session_checkin_location",
    {
      p_session_id: sessionId,
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_radius_m: input.radiusM,
    },
  );

  if (error) {
    throw toSessionApiError(error, "Could not save the check-in location.");
  }
}

export async function clearCheckInLocation(sessionId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "clear_discussion_session_checkin_location",
    { p_session_id: sessionId },
  );

  if (error) {
    throw toSessionApiError(error, "Could not clear the check-in location.");
  }
}

export async function reviewCheckIn(
  sessionId: string,
  checkInId: string,
  input: SessionCheckInReviewInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("review_discussion_session_checkin", {
    p_session_id: sessionId,
    p_checkin_id: checkInId,
    p_status: input.status,
    p_note: input.note ?? null,
  });

  if (error) {
    throw toSessionApiError(error, "Could not update this attendance row.");
  }
}

/**
 * Records or overrides attendance for one class member without coordinates.
 *
 * Used when a participant's browser cannot share a location. The database
 * verifies the target is a class member and that the caller may organize the
 * session, so a forged user id is rejected.
 */
export async function recordCheckIn(
  sessionId: string,
  input: SessionCheckInRecordInput,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "record_discussion_session_checkin",
    {
      p_session_id: sessionId,
      p_user_id: input.userId,
      p_status: input.status,
      p_note: input.note ?? null,
    },
  );

  if (error) {
    throw toSessionApiError(error, "Could not record this attendance row.");
  }

  return typeof data === "string" ? data : "";
}

function isCheckInStatus(value: unknown): value is SessionCheckInStatus {
  return (
    value === "present" ||
    value === "late" ||
    value === "excused" ||
    value === "absent"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRsvpStatus(value: unknown): value is RsvpStatus {
  return value === "going" || value === "maybe" || value === "not_going";
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

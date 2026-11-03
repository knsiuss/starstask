import "server-only";

import type {
  AttendanceExportKind,
  AttendanceMeetingCheckInInput,
  AttendanceMeetingCorrectionInput,
  AttendanceMeetingCreateInput,
  AttendanceMeetingLocationChangeInput,
} from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import type { AttendanceCheckInStatus } from "@/lib/attendance/types";
import { toSessionApiError } from "@/features/sessions/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AttendanceMeetingCheckInResult = {
  status: AttendanceCheckInStatus;
  checkedInAt: string;
  distanceM: number | null;
  accuracyM: number | null;
  alreadyCheckedIn: boolean;
};

const CHECK_IN_FAILURE_STATUS: Record<string, number> = {
  checkin_too_far: 422,
  checkin_imprecise: 422,
  checkin_name_mismatch: 422,
  checkin_nim_mismatch: 422,
  checkin_identity_missing: 422,
  checkin_not_open: 409,
  checkin_closed: 409,
  checkin_unavailable: 409,
};

/**
 * Creates one attendance meeting. The class id comes from the verified route
 * context, never from the request body.
 */
export async function createAttendanceMeeting(
  classId: string,
  input: AttendanceMeetingCreateInput,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_attendance_meeting", {
    p_class_id: classId,
    p_subject_id: input.subjectId,
    p_meeting_number: input.meetingNumber,
    p_meeting_date: input.meetingDate,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_opens_at: input.opensAt ?? null,
    p_closes_at: input.closesAt ?? null,
    p_location: input.location,
    p_late_after_minutes: input.lateAfterMinutes,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_radius_m: input.radiusM,
    p_title: input.title ?? null,
  });

  if (error) {
    throw toSessionApiError(error, "Could not create the meeting.");
  }

  if (!data) {
    throw new ApiError(500, "internal_error", "Could not create the meeting.");
  }

  return data;
}

export async function openAttendanceMeeting(sessionId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("open_attendance_meeting", {
    p_session_id: sessionId,
  });

  if (error) {
    // SS101 covers both a missing meeting point and a legacy session that
    // cannot be checked in. Here it always means the former.
    if ((error as { code?: string }).code === "SS101") {
      throw new ApiError(
        409,
        "attendance_location_missing",
        "Set the meeting point before opening attendance.",
      );
    }

    throw toSessionApiError(error, "Could not open attendance.");
  }
}

/** Closes the meeting; finalizing also writes an explicit absence per member. */
export async function closeAttendanceMeeting(
  sessionId: string,
  finalize: boolean,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("close_attendance_meeting", {
    p_session_id: sessionId,
    p_finalize: finalize,
  });

  if (error) {
    throw toSessionApiError(error, "Could not close attendance.");
  }

  return typeof data === "number" ? data : 0;
}

export async function reopenAttendanceMeeting(
  sessionId: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("reopen_attendance_meeting", {
    p_session_id: sessionId,
  });

  if (error) {
    throw toSessionApiError(error, "Could not reopen attendance.");
  }

  return typeof data === "number" ? data : 0;
}

export async function changeAttendanceMeetingLocation(
  sessionId: string,
  input: AttendanceMeetingLocationChangeInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_attendance_meeting_location", {
    p_session_id: sessionId,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_radius_m: input.radiusM,
    p_reason: input.reason,
  });

  if (error) {
    throw toSessionApiError(error, "Could not change the meeting location.");
  }
}

/**
 * Identity-verified GPS check-in.
 *
 * A structured rejection from the function becomes the API error code, so the
 * client shows the exact next step. The server never reports success unless the
 * row was actually written.
 */
export async function checkInAttendanceMeeting(
  sessionId: string,
  input: AttendanceMeetingCheckInInput,
): Promise<AttendanceMeetingCheckInResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("check_in_attendance_meeting", {
    p_session_id: sessionId,
    p_full_name: input.fullName,
    p_nim: input.nim,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_accuracy_m: input.accuracy,
  });

  if (error) {
    throw toSessionApiError(error, "Could not record your check-in.");
  }

  const payload = isRecord(data) ? data : {};

  if (payload.ok !== true) {
    const code =
      typeof payload.code === "string" ? payload.code : "checkin_unavailable";
    const message =
      typeof payload.message === "string"
        ? payload.message
        : "Could not record your check-in.";

    throw new ApiError(CHECK_IN_FAILURE_STATUS[code] ?? 409, code, message);
  }

  if (!isCheckInStatus(payload.status)) {
    throw new ApiError(
      500,
      "internal_error",
      "Could not record your check-in.",
    );
  }

  return {
    status: payload.status,
    checkedInAt:
      typeof payload.checked_in_at === "string"
        ? payload.checked_in_at
        : new Date().toISOString(),
    distanceM: readNullableNumber(payload.distance_m),
    accuracyM: readNullableNumber(payload.accuracy_m),
    alreadyCheckedIn: payload.already_checked_in === true,
  };
}

/**
 * Manual attendance correction.
 *
 * The database function is the security boundary: it requires a class
 * organizer, validates membership and the reason, refuses a present-mark
 * without an explicit physical-verification attestation, and writes the
 * append-only audit row in the same transaction.
 */
export async function recordAttendanceCorrection(
  sessionId: string,
  input: AttendanceMeetingCorrectionInput,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("record_attendance_correction", {
    p_session_id: sessionId,
    p_user_id: input.userId,
    p_status: input.status,
    p_reason: input.reason,
    p_physically_verified: input.physicallyVerified,
  });

  if (error) {
    throw toSessionApiError(error, "Could not record the correction.");
  }

  if (!data) {
    throw new ApiError(500, "internal_error", "Could not record the correction.");
  }

  return data;
}

/** Records a manager-requested export. The function re-checks class access. */
export async function logAttendanceExport(input: {
  classId: string;
  subjectId: string | null;
  sessionId: string | null;
  kind: AttendanceExportKind;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("log_attendance_export", {
    p_class_id: input.classId,
    p_subject_id: input.subjectId,
    p_session_id: input.sessionId,
    p_kind: input.kind,
  });

  if (error) {
    console.error("[attendance] could not record an export", {
      code: error.code,
    });
  }
}

function isCheckInStatus(value: unknown): value is AttendanceCheckInStatus {
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

function readNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

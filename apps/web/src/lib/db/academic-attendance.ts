import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AttendanceMeetingStatus,
  AttendanceRecordStatus,
} from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { recordServiceRoleAudit } from "@/lib/db/audit";
import type { Database } from "@/types/database";

type ServiceClient = SupabaseClient<Database>;

export type MeetingRow = {
  id: string;
  offeringId: string;
  courseName: string;
  scheduledAt: string;
  status: AttendanceMeetingStatus;
  location: string | null;
  createdAt: string;
};

export type MeetingRecordRow = {
  id: string;
  meetingId: string;
  studentIdentityId: string;
  displayName: string | null;
  studentCode: string | null;
  status: AttendanceRecordStatus;
  recordedBy: string;
  recordedAt: string;
  note: string | null;
};

export type RosterRow = {
  studentIdentityId: string;
  displayName: string | null;
  studentCode: string | null;
  membershipUserId: string | null;
};

export type OfferingTenantKeys = {
  offeringId: string;
  classId: string;
  universityId: string;
  courseName: string;
};

/**
 * Loads the offering with its class/tenant keys, explicitly filtered.
 * Returns null when the offering does not exist or is not part of the class.
 */
export async function getOfferingForClass(
  client: ServiceClient,
  offeringId: string,
  classId: string,
): Promise<OfferingTenantKeys | null> {
  const { data, error } = await client
    .from("course_offerings")
    .select(
      "id, class_id, university_id, courses!course_offerings_course_id_fkey ( name )",
    )
    .eq("id", offeringId)
    .eq("class_id", classId)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not load the offering", error.code);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as {
    id: string;
    class_id: string;
    university_id: string;
    courses: { name: string } | null;
  };

  return {
    offeringId: row.id,
    classId: row.class_id,
    universityId: row.university_id,
    courseName: row.courses?.name ?? "Unknown course",
  };
}

/**
 * All meetings for a class's offerings, newest first. The caller must already
 * be authorized (manage_attendance or platform admin).
 */
export async function listMeetingsForClass(
  client: ServiceClient,
  offeringIds: string[],
): Promise<MeetingRow[]> {
  if (offeringIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("attendance_meetings")
    .select(
      "id, offering_id, scheduled_at, status, location, created_at, course_offerings!attendance_meetings_offering_same_university ( courses!course_offerings_course_id_fkey ( name ) )",
    )
    .in("offering_id", offeringIds)
    .order("scheduled_at", { ascending: false });

  if (error) {
    throw new DataAccessError("Could not load meetings", error.code);
  }

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    offering_id: string;
    scheduled_at: string;
    status: AttendanceMeetingStatus;
    location: string | null;
    created_at: string;
    course_offerings: { courses: { name: string } | null } | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    offeringId: row.offering_id,
    courseName: row.course_offerings?.courses?.name ?? "Unknown course",
    scheduledAt: row.scheduled_at,
    status: row.status,
    location: row.location,
    createdAt: row.created_at,
  }));
}

/**
 * Roster for one offering: active enrollments joined with identity/profile
 * details. Identities are not readable by clients under RLS, so this read is
 * server-side only and explicitly scoped to the offering.
 */
export async function getOfferingRoster(
  client: ServiceClient,
  offeringId: string,
  universityId: string,
): Promise<RosterRow[]> {
  const { data: enrollmentRows, error: enrollmentError } = await client
    .from("enrollments")
    .select("student_identity_id")
    .eq("offering_id", offeringId)
    .eq("university_id", universityId)
    .eq("status", "active");

  if (enrollmentError) {
    throw new DataAccessError(
      "Could not load the offering roster",
      enrollmentError.code,
    );
  }

  const identityIds = [
    ...new Set((enrollmentRows ?? []).map((row) => row.student_identity_id)),
  ];

  if (identityIds.length === 0) {
    return [];
  }

  const { data: identityRows, error: identityError } = await client
    .from("student_identities")
    .select("id, student_id, university_membership_id")
    .in("id", identityIds)
    .eq("university_id", universityId);

  if (identityError) {
    throw new DataAccessError(
      "Could not load student identities",
      identityError.code,
    );
  }

  const identities = identityRows ?? [];
  const membershipIds = [
    ...new Set(identities.map((row) => row.university_membership_id)),
  ];

  const { data: membershipRows, error: membershipError } = await client
    .from("university_memberships")
    .select("id, user_id")
    .in("id", membershipIds)
    .eq("university_id", universityId);

  if (membershipError) {
    throw new DataAccessError(
      "Could not load memberships",
      membershipError.code,
    );
  }

  const userByMembership = new Map(
    (membershipRows ?? []).map((row) => [row.id, row.user_id]),
  );
  const profileIds = [...new Set(userByMembership.values())];

  const { data: profileRows, error: profileError } = await client
    .from("profiles")
    .select("id, display_name")
    .in("id", profileIds);

  if (profileError) {
    throw new DataAccessError("Could not load profiles", profileError.code);
  }

  const nameByUser = new Map(
    (profileRows ?? []).map((row) => [row.id, row.display_name]),
  );

  return identities.map((row) => {
    const userId = userByMembership.get(row.university_membership_id);

    return {
      studentIdentityId: row.id,
      displayName: userId ? (nameByUser.get(userId) ?? null) : null,
      studentCode: row.student_id,
      membershipUserId: userId ?? null,
    };
  });
}

export async function listRecordsForMeeting(
  client: ServiceClient,
  meetingId: string,
): Promise<MeetingRecordRow[]> {
  const { data, error } = await client
    .from("attendance_records")
    .select(
      "id, meeting_id, student_identity_id, status, recorded_by, recorded_at, note",
    )
    .eq("meeting_id", meetingId)
    .order("recorded_at", { ascending: true });

  if (error) {
    throw new DataAccessError("Could not load attendance records", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    meetingId: row.meeting_id,
    studentIdentityId: row.student_identity_id,
    displayName: null,
    studentCode: null,
    status: row.status as AttendanceRecordStatus,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
    note: row.note,
  }));
}

export type CorrectionRow = {
  id: string;
  recordId: string;
  previousStatus: AttendanceRecordStatus;
  newStatus: AttendanceRecordStatus;
  reason: string;
  correctedBy: string;
  correctedAt: string;
};

export async function listCorrectionsForMeeting(
  client: ServiceClient,
  recordIds: string[],
): Promise<CorrectionRow[]> {
  if (recordIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("attendance_corrections")
    .select(
      "id, record_id, previous_status, new_status, reason, corrected_by, corrected_at",
    )
    .in("record_id", recordIds)
    .order("corrected_at", { ascending: false });

  if (error) {
    throw new DataAccessError(
      "Could not load attendance corrections",
      error.code,
    );
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    recordId: row.record_id,
    previousStatus: row.previous_status as AttendanceRecordStatus,
    newStatus: row.new_status as AttendanceRecordStatus,
    reason: row.reason,
    correctedBy: row.corrected_by,
    correctedAt: row.corrected_at,
  }));
}

export type CreateMeetingInput = {
  offeringId: string;
  scheduledAt: string;
  status: AttendanceMeetingStatus;
  location?: string | null | undefined;
};

export async function createMeeting(
  client: ServiceClient,
  actorId: string,
  offering: OfferingTenantKeys,
  input: CreateMeetingInput,
): Promise<{ meetingId: string }> {
  const { data, error } = await client
    .from("attendance_meetings")
    .insert({
      university_id: offering.universityId,
      offering_id: offering.offeringId,
      scheduled_at: input.scheduledAt,
      status: input.status,
      location: input.location ?? null,
      created_by: actorId,
    })
    .select("id")
    .single();

  if (error) {
    throw new DataAccessError("Could not create the meeting", error.code);
  }

  const meetingId = data.id as string;

  await recordServiceRoleAudit(client, {
    actorId,
    action: "attendance_meeting_created",
    entityType: "attendance_meeting",
    entityId: meetingId,
    classId: offering.classId,
    universityId: offering.universityId,
    metadata: {
      offering_id: offering.offeringId,
      scheduled_at: input.scheduledAt,
      status: input.status,
    },
  });

  return { meetingId };
}

/** Resolves a meeting back to its offering/tenant keys, or null. */
async function getMeetingScope(
  client: ServiceClient,
  meetingId: string,
): Promise<{
  meetingId: string;
  offeringId: string;
  universityId: string;
  classId: string;
} | null> {
  const { data, error } = await client
    .from("attendance_meetings")
    .select(
      "id, offering_id, university_id, course_offerings!attendance_meetings_offering_same_university ( class_id )",
    )
    .eq("id", meetingId)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not load the meeting", error.code);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as {
    id: string;
    offering_id: string;
    university_id: string;
    course_offerings: { class_id: string } | null;
  };

  if (!row.course_offerings) {
    return null;
  }

  return {
    meetingId: row.id,
    offeringId: row.offering_id,
    universityId: row.university_id,
    classId: row.course_offerings.class_id,
  };
}

export async function recordRosterUpsert(
  client: ServiceClient,
  actorId: string,
  meetingId: string,
  classId: string,
  entries: Array<{ studentIdentityId: string; status: AttendanceRecordStatus }>,
): Promise<{ upserted: number; skipped: string[] }> {
  const scope = await getMeetingScope(client, meetingId);

  if (!scope || scope.classId !== classId) {
    return {
      upserted: 0,
      skipped: entries.map((entry) => entry.studentIdentityId),
    };
  }

  // Only identities actively enrolled in this offering may be recorded;
  // anything else is skipped and reported, never silently written.
  const { data: enrollmentRows, error: enrollmentError } = await client
    .from("enrollments")
    .select("student_identity_id")
    .eq("offering_id", scope.offeringId)
    .eq("university_id", scope.universityId)
    .eq("status", "active")
    .in(
      "student_identity_id",
      entries.map((entry) => entry.studentIdentityId),
    );

  if (enrollmentError) {
    throw new DataAccessError(
      "Could not validate enrollments",
      enrollmentError.code,
    );
  }

  const enrolled = new Set(
    (enrollmentRows ?? []).map((row) => row.student_identity_id),
  );
  const writable = entries.filter((entry) =>
    enrolled.has(entry.studentIdentityId),
  );
  const skipped = entries
    .filter((entry) => !enrolled.has(entry.studentIdentityId))
    .map((entry) => entry.studentIdentityId);

  if (writable.length === 0) {
    return { upserted: 0, skipped };
  }

  const { error: upsertError } = await client.from("attendance_records").upsert(
    writable.map((entry) => ({
      university_id: scope.universityId,
      meeting_id: scope.meetingId,
      student_identity_id: entry.studentIdentityId,
      status: entry.status,
      recorded_by: actorId,
      recorded_at: new Date().toISOString(),
    })),
    { onConflict: "meeting_id,student_identity_id" },
  );

  if (upsertError) {
    throw new DataAccessError("Could not record attendance", upsertError.code);
  }

  await recordServiceRoleAudit(client, {
    actorId,
    action: "attendance_records_upserted",
    entityType: "attendance_meeting",
    entityId: scope.meetingId,
    classId: scope.classId,
    universityId: scope.universityId,
    metadata: { upserted: writable.length, skipped: skipped.length },
  });

  return { upserted: writable.length, skipped };
}

/**
 * Corrects one record. The previous status is copied into the append-only
 * corrections ledger; the record itself is updated in place.
 */
export async function correctRecord(
  client: ServiceClient,
  actorId: string,
  classId: string,
  recordId: string,
  newStatus: AttendanceRecordStatus,
  reason: string,
): Promise<"corrected" | "not_found" | "unchanged"> {
  const { data: record, error: recordError } = await client
    .from("attendance_records")
    .select("id, meeting_id, university_id, status")
    .eq("id", recordId)
    .maybeSingle();

  if (recordError) {
    throw new DataAccessError("Could not load the record", recordError.code);
  }

  if (!record) {
    return "not_found";
  }

  const scope = await getMeetingScope(client, record.meeting_id);

  if (
    !scope ||
    scope.classId !== classId ||
    record.university_id !== scope.universityId
  ) {
    return "not_found";
  }

  if (record.status === newStatus) {
    return "unchanged";
  }

  const { error: correctionError } = await client
    .from("attendance_corrections")
    .insert({
      university_id: scope.universityId,
      record_id: record.id,
      previous_status: record.status,
      new_status: newStatus,
      reason,
      corrected_by: actorId,
    });

  if (correctionError) {
    throw new DataAccessError(
      "Could not write the correction ledger",
      correctionError.code,
    );
  }

  const { error: updateError } = await client
    .from("attendance_records")
    .update({
      status: newStatus,
      recorded_by: actorId,
      recorded_at: new Date().toISOString(),
    })
    .eq("id", record.id);

  if (updateError) {
    throw new DataAccessError(
      "Could not apply the corrected status",
      updateError.code,
    );
  }

  await recordServiceRoleAudit(client, {
    actorId,
    action: "attendance_record_corrected",
    entityType: "attendance_record",
    entityId: record.id,
    classId: scope.classId,
    universityId: scope.universityId,
    metadata: { previous_status: record.status, new_status: newStatus },
  });

  return "corrected";
}

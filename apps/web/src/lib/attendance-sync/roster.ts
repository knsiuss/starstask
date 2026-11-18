import "server-only";

import type {
  SyncAttendanceStatus,
  SyncSessionPayload,
  SyncStudentRecord,
} from "@starstask/contracts";

import { filterRosterByCourseAccess } from "@/lib/db/course-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Maps StarsTask attendance statuses into the four SIAKAD sync categories.
 */
export function mapAttendanceStatusToSyncStatus(
  status: string | null | undefined,
): SyncAttendanceStatus {
  switch (status) {
    case "present":
    case "late":
      return "hadir";
    case "excused":
    case "leave":
      return "izin";
    case "sick":
      return "sakit";
    case "absent":
    case "not_recorded":
    case "unmarked":
    default:
      return "alpa";
  }
}

/**
 * Loads only the minimal meeting metadata and student `{ nim, displayName, status }`
 * list needed by the browser extension, using the service-role client after
 * the caller's HMAC sync token has already been verified.
 */
export async function getAttendanceSyncSessionPayload(
  meetingId: string,
  classId: string,
  expiresAt: string,
): Promise<SyncSessionPayload | null> {
  const supabase = createSupabaseAdminClient();

  const [sessionResult, classResult] = await Promise.all([
    supabase
      .from("discussion_sessions")
      .select("id, class_id, subject_id, meeting_number, title, starts_at")
      .eq("id", meetingId)
      .eq("class_id", classId)
      .maybeSingle(),
    supabase.from("classes").select("id, name").eq("id", classId).maybeSingle(),
  ]);

  if (sessionResult.error || classResult.error) {
    throw new Error("Could not load attendance meeting for sync.");
  }

  const session = sessionResult.data;
  const classRow = classResult.data;

  if (!session || !classRow) {
    return null;
  }

  const [membersResult, subjectMembersResult, checkinsResult] =
    await Promise.all([
      supabase
        .from("class_members")
        .select("user_id, joined_at")
        .eq("class_id", classId),
      session.subject_id
        ? supabase
            .from("class_subject_members")
            .select("user_id")
            .eq("class_id", classId)
            .eq("subject_id", session.subject_id)
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("discussion_session_checkins")
        .select("user_id, status")
        .eq("session_id", meetingId),
    ]);

  if (
    membersResult.error ||
    subjectMembersResult.error ||
    checkinsResult.error
  ) {
    throw new Error("Could not load meeting roster for sync.");
  }

  const enrolledSet = subjectMembersResult.data
    ? new Set(subjectMembersResult.data.map((row) => row.user_id))
    : null;
  const startsAtMs = new Date(session.starts_at).getTime();

  const rawEligibleIds = (membersResult.data ?? [])
    .filter((member) => {
      if (enrolledSet && !enrolledSet.has(member.user_id)) {
        return false;
      }

      return new Date(member.joined_at).getTime() <= startsAtMs;
    })
    .map((member) => member.user_id);

  const filteredEligible = session.subject_id
    ? await filterRosterByCourseAccess(
        classId,
        session.subject_id,
        rawEligibleIds.map((userId) => ({ userId })),
        supabase,
      )
    : rawEligibleIds.map((userId) => ({ userId }));

  const eligibleUserIds = filteredEligible.map((item) => item.userId);

  if (eligibleUserIds.length === 0) {
    return {
      meetingId: session.id,
      meetingTitle: buildMeetingTitle(session.meeting_number, session.title),
      className: classRow.name,
      expiresAt,
      students: [],
    };
  }

  const profilesResult = await supabase
    .from("profiles")
    .select("id, full_name, display_name, nim")
    .in("id", eligibleUserIds);

  if (profilesResult.error) {
    throw new Error("Could not load student profiles for sync.");
  }

  const profileMap = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile]),
  );
  const checkinMap = new Map(
    (checkinsResult.data ?? []).map((row) => [row.user_id, row.status]),
  );

  const students: SyncStudentRecord[] = eligibleUserIds
    .map((userId) => {
      const profile = profileMap.get(userId);
      const displayName =
        profile?.full_name?.trim() || profile?.display_name?.trim() || "Member";
      const nim = profile?.nim?.trim() || null;
      const status = mapAttendanceStatusToSyncStatus(checkinMap.get(userId));

      return { nim, displayName, status };
    })
    .sort((left, right) => {
      const byName = left.displayName.localeCompare(right.displayName, "id", {
        sensitivity: "base",
      });

      if (byName !== 0) {
        return byName;
      }

      return (left.nim ?? "").localeCompare(right.nim ?? "");
    });

  return {
    meetingId: session.id,
    meetingTitle: buildMeetingTitle(session.meeting_number, session.title),
    className: classRow.name,
    expiresAt,
    students,
  };
}

function buildMeetingTitle(
  meetingNumber: number | null,
  title: string,
): string {
  const trimmedTitle = title.trim();

  if (meetingNumber !== null && trimmedTitle) {
    return `Pertemuan ${meetingNumber} - ${trimmedTitle}`;
  }

  if (meetingNumber !== null) {
    return `Pertemuan ${meetingNumber}`;
  }

  return trimmedTitle || "Pertemuan";
}

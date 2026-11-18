import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import { listMyClassDirectory } from "@/lib/db/classes";
import {
  summarizeBapProgress,
  type BapMeetingInput,
  type BapOfferingInput,
  type LecturerBapSummary,
} from "@/lib/lecturer/bap-progress";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OfferingQueryRow = {
  id: string;
  class_id: string;
  courses: { name: string; code: string | null } | null;
};

type AttendanceMeetingBapRow = {
  offering_id: string;
  status: string;
  bap_topic: string | null;
  target_meetings: number | null;
};

type MemberScopeRow = {
  class_id: string;
  course_scope: string | null;
};

type MemberCourseRow = {
  class_id: string;
  class_subjects: { id: string; name: string; code: string | null } | null;
};

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Loads BAP topic completion and meeting count progress (vs 14-16 target)
 * across active classes the lecturer teaches, scoped to their selected courses
 * when `course_scope = 'selected'`.
 */
export async function getLecturerBapProgress(
  userId: string,
): Promise<LecturerBapSummary> {
  const directory = await listMyClassDirectory(userId);
  const activeClasses = directory.filter((row) => row.status === "active");

  if (activeClasses.length === 0) {
    return summarizeBapProgress([]);
  }

  const classMap = new Map(activeClasses.map((row) => [row.id, row]));
  const classIds = activeClasses.map((row) => row.id);
  const supabase = await createSupabaseServerClient();

  const [offeringRes, memberRes, selectedCoursesRes] = await Promise.all([
    supabase
      .from("course_offerings")
      .select(
        "id, class_id, courses!course_offerings_course_id_fkey ( name, code )",
      )
      .in("class_id", classIds)
      .in("status", ["open", "draft"]),
    supabase
      .from("class_members")
      .select("class_id, course_scope")
      .eq("user_id", userId)
      .in("class_id", classIds),
    supabase
      .from("class_member_courses")
      .select("class_id, class_subjects ( id, name, code )")
      .eq("user_id", userId)
      .in("class_id", classIds),
  ]);

  if (offeringRes.error) {
    throw new DataAccessError(
      "Could not load course offerings for BAP tracking",
      offeringRes.error.code,
    );
  }

  const selectedClassIds = new Set(
    ((memberRes.data ?? []) as MemberScopeRow[])
      .filter((row) => row.course_scope === "selected")
      .map((row) => row.class_id),
  );

  const allowedKeysByClass = new Map<string, Set<string>>();

  for (const row of (selectedCoursesRes.data ??
    []) as unknown as MemberCourseRow[]) {
    if (!row.class_subjects) {
      continue;
    }

    const keys = allowedKeysByClass.get(row.class_id) ?? new Set<string>();
    const nameKey = normalizeKey(row.class_subjects.name);
    const codeKey = normalizeKey(row.class_subjects.code);

    if (nameKey) {
      keys.add(nameKey);
    }

    if (codeKey) {
      keys.add(codeKey);
    }

    allowedKeysByClass.set(row.class_id, keys);
  }

  const allOfferings = (offeringRes.data ??
    []) as unknown as OfferingQueryRow[];
  const offerings = allOfferings.filter((offering) => {
    if (!selectedClassIds.has(offering.class_id)) {
      return true;
    }

    const allowedKeys = allowedKeysByClass.get(offering.class_id);

    if (!allowedKeys || allowedKeys.size === 0) {
      return false;
    }

    const courseName = normalizeKey(offering.courses?.name);
    const courseCode = normalizeKey(offering.courses?.code);

    return (
      allowedKeys.has(courseName) ||
      (courseCode !== "" && allowedKeys.has(courseCode))
    );
  });

  if (offerings.length === 0) {
    return summarizeBapProgress([]);
  }

  const offeringIds = offerings.map((row) => row.id);
  const { data: meetingData, error: meetingError } = await supabase
    .from("attendance_meetings")
    .select("offering_id, status, bap_topic, target_meetings")
    .in("offering_id", offeringIds);

  if (meetingError) {
    throw new DataAccessError(
      "Could not load attendance meetings for BAP tracking",
      meetingError.code,
    );
  }

  const meetingRows = (meetingData ??
    []) as unknown as AttendanceMeetingBapRow[];
  const meetingsByOffering = new Map<string, BapMeetingInput[]>();

  for (const row of meetingRows) {
    const list = meetingsByOffering.get(row.offering_id) ?? [];
    list.push({
      status: row.status,
      bapTopic: row.bap_topic,
      targetMeetings: row.target_meetings,
    });
    meetingsByOffering.set(row.offering_id, list);
  }

  const inputs: BapOfferingInput[] = offerings.flatMap((offering) => {
    const klass = classMap.get(offering.class_id);

    if (!klass) {
      return [];
    }

    return [
      {
        offeringId: offering.id,
        classId: offering.class_id,
        className: klass.name,
        classSlug: klass.slug,
        courseName: offering.courses?.name ?? klass.course_name,
        meetings: meetingsByOffering.get(offering.id) ?? [],
      },
    ];
  });

  return summarizeBapProgress(inputs);
}

import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CourseScope = "all" | "selected";

export type MemberCourseAccess = {
  scope: CourseScope;
  allowedSubjectIds: Set<string>;
};

export async function getMemberCourseAccess(
  classId: string,
  userId: string,
): Promise<MemberCourseAccess> {
  const supabase = await createSupabaseServerClient();
  const { data: member } = await supabase
    .from("class_members")
    .select("course_scope")
    .eq("class_id", classId)
    .eq("user_id", userId)
    .maybeSingle();

  const scope: CourseScope =
    member?.course_scope === "selected" ? "selected" : "all";

  if (scope === "all") {
    return { scope: "all", allowedSubjectIds: new Set() };
  }

  const { data: rows } = await supabase
    .from("class_member_courses")
    .select("subject_id")
    .eq("class_id", classId)
    .eq("user_id", userId);

  return {
    scope: "selected",
    allowedSubjectIds: new Set((rows ?? []).map((row) => row.subject_id)),
  };
}

export async function canAccessCourse(
  classId: string,
  userId: string,
  subjectId: string,
): Promise<boolean> {
  const access = await getMemberCourseAccess(classId, userId);

  return access.scope === "all" || access.allowedSubjectIds.has(subjectId);
}

/**
 * Excludes retake students (`course_scope = 'selected'`) from attendance
 * sheets and exports of courses they are not enrolled in.
 */
export async function filterRosterByCourseAccess<T extends { userId: string }>(
  classId: string,
  subjectId: string,
  roster: T[],
): Promise<T[]> {
  if (roster.length === 0) {
    return roster;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: restricted, error: restrictedError } = await admin
      .from("class_members")
      .select("user_id")
      .eq("class_id", classId)
      .eq("course_scope", "selected");

    if (restrictedError) {
      throw new DataAccessError(
        "Could not load member course scope",
        restrictedError.code,
      );
    }

    const restrictedIds = new Set((restricted ?? []).map((r) => r.user_id));

    if (restrictedIds.size === 0) {
      return roster;
    }

    const { data: enrolled, error: enrolledError } = await admin
      .from("class_member_courses")
      .select("user_id")
      .eq("class_id", classId)
      .eq("subject_id", subjectId);

    if (enrolledError) {
      throw new DataAccessError(
        "Could not load member course enrollments",
        enrolledError.code,
      );
    }

    const enrolledIds = new Set((enrolled ?? []).map((r) => r.user_id));

    return roster.filter(
      (member) =>
        !restrictedIds.has(member.userId) || enrolledIds.has(member.userId),
    );
  } catch (error) {
    if (error instanceof DataAccessError) {
      throw error;
    }

    throw new DataAccessError("Could not verify member course access");
  }
}

export async function listUserCourseAccessMap(
  userId: string,
  classIds: string[],
): Promise<Map<string, MemberCourseAccess>> {
  const map = new Map<string, MemberCourseAccess>();

  if (classIds.length === 0) {
    return map;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: members } = await supabase
      .from("class_members")
      .select("class_id, course_scope")
      .eq("user_id", userId)
      .in("class_id", classIds);

    const selectedClassIds: string[] = [];

    for (const row of members ?? []) {
      if (row.course_scope === "selected") {
        selectedClassIds.push(row.class_id);
        map.set(row.class_id, {
          scope: "selected",
          allowedSubjectIds: new Set(),
        });
      }
    }

    if (selectedClassIds.length === 0) {
      return map;
    }

    const { data: courses } = await supabase
      .from("class_member_courses")
      .select("class_id, subject_id")
      .eq("user_id", userId)
      .in("class_id", selectedClassIds);

    for (const row of courses ?? []) {
      map.get(row.class_id)?.allowedSubjectIds.add(row.subject_id);
    }
  } catch {
    return map;
  }

  return map;
}

export async function setMemberCourseAccess(params: {
  classId: string;
  userId: string;
  scope: CourseScope;
  subjectIds: string[];
}): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data: memberRow, error: memberLookupError } = await admin
    .from("class_members")
    .select("user_id")
    .eq("class_id", params.classId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (memberLookupError) {
    throw new DataAccessError(
      "Could not verify class membership",
      memberLookupError.code,
    );
  }

  if (!memberRow) {
    throw new DataAccessError("Member not found in this class", "P0002");
  }

  const uniqueSubjectIds = [...new Set(params.subjectIds)];

  if (params.scope === "selected" && uniqueSubjectIds.length > 0) {
    const { data: validSubjects, error: subjectError } = await admin
      .from("class_subjects")
      .select("id")
      .eq("class_id", params.classId)
      .in("id", uniqueSubjectIds);

    if (subjectError) {
      throw new DataAccessError(
        "Could not validate course subjects",
        subjectError.code,
      );
    }

    if ((validSubjects ?? []).length !== uniqueSubjectIds.length) {
      throw new DataAccessError(
        "One or more selected courses do not belong to this class",
        "22023",
      );
    }
  }

  const { error: updateError } = await admin
    .from("class_members")
    .update({ course_scope: params.scope })
    .eq("class_id", params.classId)
    .eq("user_id", params.userId);

  if (updateError) {
    throw new DataAccessError(
      "Could not update member course scope",
      updateError.code,
    );
  }

  const { error: deleteError } = await admin
    .from("class_member_courses")
    .delete()
    .eq("class_id", params.classId)
    .eq("user_id", params.userId);

  if (deleteError) {
    throw new DataAccessError(
      "Could not clear member course assignments",
      deleteError.code,
    );
  }

  if (params.scope === "selected" && uniqueSubjectIds.length > 0) {
    const { error: insertError } = await admin
      .from("class_member_courses")
      .insert(
        uniqueSubjectIds.map((subjectId) => ({
          class_id: params.classId,
          user_id: params.userId,
          subject_id: subjectId,
        })),
      );

    if (insertError) {
      throw new DataAccessError(
        "Could not save member course assignments",
        insertError.code,
      );
    }
  }
}

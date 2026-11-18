import "server-only";

import {
  buildCanonicalClassIdentity,
  type KrsImportConfirmInput,
} from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import { DataAccessError } from "@/lib/db/assignments";
import {
  DuplicateSubjectCodeError,
  createClassSubject,
  getClassBySlug,
  getClassRole,
} from "@/lib/db/classes";
import { createClassAsStudent } from "@/lib/db/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type KrsImportResult = {
  classId: string;
  slug: string;
  name: string;
  subjectsCreated: number;
  schedulesCreated: number;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function scheduleKey(
  subjectId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): string {
  return `${subjectId}|${dayOfWeek}|${startTime.slice(0, 5)}|${endTime.slice(0, 5)}`;
}

async function resolveOrCreateClass(input: KrsImportConfirmInput): Promise<{
  classId: string;
  slug: string;
  name: string;
  createdNew: boolean;
}> {
  const identity = buildCanonicalClassIdentity({
    classCode: input.classCode,
    semesterNumber: input.semesterNumber,
    academicYear: input.academicYear,
  });
  const primaryCourseName =
    input.courses[0]?.courseName.trim() ?? identity.classCode;

  try {
    const classId = await createClassAsStudent({
      slug: identity.slug,
      name: identity.name,
      courseName: primaryCourseName,
      semester: identity.semesterLabel,
      academicYear: identity.academicYear,
      description: `Class workspace for ${identity.name}.`,
      joinPolicy: input.joinPolicy,
    });

    return {
      classId,
      slug: identity.slug,
      name: identity.name,
      createdNew: true,
    };
  } catch (error) {
    if (error instanceof DataAccessError && error.code === "23505") {
      const existing = await getClassBySlug(identity.slug);

      if (existing) {
        const role = await getClassRole(existing.id);

        if (role.canManage) {
          return {
            classId: existing.id,
            slug: existing.slug,
            name: existing.name,
            createdNew: false,
          };
        }
      }

      throw new ApiError(
        409,
        "slug_taken",
        "That class already exists for this semester and academic year. Ask a classmate for the invitation link or join if it is open.",
        {
          classCode:
            "A class with this code, semester, and academic year already exists.",
        },
      );
    }

    throw error;
  }
}

async function listExistingSubjects(classId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_subjects")
    .select("id, name, code")
    .eq("class_id", classId);

  if (error) {
    throw new DataAccessError("Could not load class subjects", error.code);
  }

  return data ?? [];
}

async function ensureSubjects(
  classId: string,
  courses: KrsImportConfirmInput["courses"],
): Promise<{
  subjectIdByIndex: string[];
  subjectsCreated: number;
}> {
  const existing = await listExistingSubjects(classId);
  const byCode = new Map<string, string>();
  const byName = new Map<string, string>();

  for (const row of existing) {
    if (row.code) {
      byCode.set(normalizeKey(row.code), row.id);
    }

    byName.set(normalizeKey(row.name), row.id);
  }

  const subjectIdByIndex: string[] = [];
  let subjectsCreated = 0;

  for (const course of courses) {
    const codeKey = normalizeKey(course.courseCode);
    const nameKey = normalizeKey(course.courseName);
    const matchedId = byCode.get(codeKey) ?? byName.get(nameKey);

    if (matchedId) {
      subjectIdByIndex.push(matchedId);
      continue;
    }

    try {
      const createdId = await createClassSubject(classId, {
        name: course.courseName.trim(),
        code: course.courseCode.trim().toUpperCase(),
        description: undefined,
        lecturerName: course.lecturerName ?? undefined,
      });

      byCode.set(codeKey, createdId);
      byName.set(nameKey, createdId);
      subjectIdByIndex.push(createdId);
      subjectsCreated += 1;
    } catch (error) {
      if (error instanceof DuplicateSubjectCodeError) {
        const refreshed = await listExistingSubjects(classId);
        const found = refreshed.find(
          (row) =>
            (row.code && normalizeKey(row.code) === codeKey) ||
            normalizeKey(row.name) === nameKey,
        );

        if (found) {
          byCode.set(codeKey, found.id);
          byName.set(nameKey, found.id);
          subjectIdByIndex.push(found.id);
          continue;
        }
      }

      throw error;
    }
  }

  return { subjectIdByIndex, subjectsCreated };
}

async function insertNonDuplicateSchedules(
  classId: string,
  userId: string,
  courses: KrsImportConfirmInput["courses"],
  subjectIdByIndex: string[],
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data: existingRows, error: loadError } = await supabase
    .from("class_course_schedules")
    .select("subject_id, day_of_week, start_time, end_time")
    .eq("class_id", classId);

  if (loadError) {
    throw new DataAccessError(
      "Could not load existing class schedule",
      loadError.code,
    );
  }

  const seen = new Set<string>(
    (existingRows ?? []).map((row) =>
      scheduleKey(
        row.subject_id,
        row.day_of_week,
        row.start_time,
        row.end_time,
      ),
    ),
  );

  const toInsert = courses.flatMap((course, index) => {
    const subjectId = subjectIdByIndex[index];

    if (
      !subjectId ||
      course.dayOfWeek == null ||
      !course.startTime ||
      !course.endTime ||
      course.endTime <= course.startTime
    ) {
      return [];
    }

    const key = scheduleKey(
      subjectId,
      course.dayOfWeek,
      course.startTime,
      course.endTime,
    );

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);

    return [
      {
        class_id: classId,
        subject_id: subjectId,
        day_of_week: course.dayOfWeek,
        start_time: course.startTime,
        end_time: course.endTime,
        room: course.room ?? null,
        lecturer_name: course.lecturerName ?? null,
        created_by: userId,
      },
    ];
  });

  if (toInsert.length === 0) {
    return 0;
  }

  const { error: insertError } = await supabase
    .from("class_course_schedules")
    .insert(toInsert);

  if (insertError?.code === "23P01") {
    throw new ApiError(
      409,
      "schedule_collision",
      "One or more imported schedule slots overlap with an existing schedule entry.",
    );
  }

  if (insertError) {
    throw new DataAccessError(
      "Could not import the schedule entries",
      insertError.code,
    );
  }

  return toInsert.length;
}

/**
 * Provisions a class (or reuses an existing one the caller manages), inserts
 * non-duplicate `class_subjects`, and inserts non-duplicate weekly schedule
 * entries from a confirmed KRS import payload.
 */
export async function importKrsClass(
  userId: string,
  input: KrsImportConfirmInput,
): Promise<KrsImportResult> {
  const { classId, slug, name, createdNew } = await resolveOrCreateClass(input);

  try {
    const { subjectIdByIndex, subjectsCreated } = await ensureSubjects(
      classId,
      input.courses,
    );
    const schedulesCreated = await insertNonDuplicateSchedules(
      classId,
      userId,
      input.courses,
      subjectIdByIndex,
    );

    return {
      classId,
      slug,
      name,
      subjectsCreated,
      schedulesCreated,
    };
  } catch (error) {
    if (createdNew) {
      const supabase = await createSupabaseServerClient();
      await supabase.from("classes").delete().eq("id", classId);
    }

    throw error;
  }
}

import "server-only";

import type {
  ClassScheduleCreateInput,
  ClassScheduleUpdateInput,
} from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { listMyClasses } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClassScheduleEntry = {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_lecturer_name: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  lecturer_name: string | null;
};

export type WeeklyScheduleEntry = ClassScheduleEntry & {
  class_name: string;
  class_slug: string;
};

/**
 * Weekly schedule of one class. Row-level security limits reads to class
 * members and platform admins, so no extra filter is needed here.
 */
export async function listClassSchedule(
  classId: string,
): Promise<ClassScheduleEntry[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_course_schedules")
    .select(
      "id, subject_id, day_of_week, start_time, end_time, room, lecturer_name, class_subjects!class_course_schedules_subject_id_fkey ( name, lecturer_name )",
    )
    .eq("class_id", classId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new DataAccessError("Could not load the class schedule", error.code);
  }

  return (data ?? []).flatMap((row) => {
    const subject = row.class_subjects;

    if (!subject) {
      return [];
    }

    return [
      {
        id: row.id,
        subject_id: row.subject_id,
        subject_name: subject.name,
        subject_lecturer_name: subject.lecturer_name,
        day_of_week: row.day_of_week,
        start_time: row.start_time.slice(0, 5),
        end_time: row.end_time.slice(0, 5),
        room: row.room,
        lecturer_name: row.lecturer_name,
      },
    ];
  });
}

/** Confirms the subject belongs to this class before writing a schedule row. */
async function requireSubjectInClass(
  classId: string,
  subjectId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_subjects")
    .select("id, class_id")
    .eq("id", subjectId)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not load the subject", error.code);
  }

  if (!data || data.class_id !== classId) {
    throw new DataAccessError("Subject not found in this class", "P0002");
  }
}

export async function createClassScheduleEntry(
  classId: string,
  userId: string,
  input: ClassScheduleCreateInput,
): Promise<string> {
  await requireSubjectInClass(classId, input.subjectId);

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_course_schedules")
    .insert({
      class_id: classId,
      subject_id: input.subjectId,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      end_time: input.endTime,
      room: input.room ?? null,
      lecturer_name: input.lecturerName ?? null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new DataAccessError("Could not add the schedule entry", error?.code);
  }

  return data.id;
}

export async function updateClassScheduleEntry(
  classId: string,
  scheduleId: string,
  input: ClassScheduleUpdateInput,
): Promise<void> {
  await requireSubjectInClass(classId, input.subjectId);

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("class_course_schedules")
    .update({
      subject_id: input.subjectId,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      end_time: input.endTime,
      room: input.room ?? null,
      lecturer_name: input.lecturerName ?? null,
    })
    .eq("id", scheduleId)
    .eq("class_id", classId);

  if (error) {
    throw new DataAccessError(
      "Could not update the schedule entry",
      error.code,
    );
  }
}

export async function deleteClassScheduleEntry(
  classId: string,
  scheduleId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("class_course_schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("class_id", classId);

  if (error) {
    throw new DataAccessError(
      "Could not delete the schedule entry",
      error.code,
    );
  }
}

/**
 * Weekly schedule across every active class the caller belongs to, for the
 * Schedule page. Memberships are resolved first so the query can never widen
 * beyond the caller's own classes.
 */
export async function listMyWeeklySchedule(
  userId: string,
): Promise<WeeklyScheduleEntry[]> {
  const memberships = await listMyClasses(userId);
  const classIds = memberships
    .filter((classItem) => classItem.status === "active")
    .map((classItem) => classItem.id);

  if (classIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_course_schedules")
    .select(
      "id, subject_id, day_of_week, start_time, end_time, room, lecturer_name, classes!class_course_schedules_class_id_fkey ( name, slug ), class_subjects!class_course_schedules_subject_id_fkey ( name, lecturer_name )",
    )
    .in("class_id", classIds)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new DataAccessError(
      "Could not load your weekly schedule",
      error.code,
    );
  }

  return (data ?? []).flatMap((row) => {
    const subject = row.class_subjects;
    const klass = row.classes;

    if (!subject || !klass) {
      return [];
    }

    return [
      {
        id: row.id,
        subject_id: row.subject_id,
        subject_name: subject.name,
        subject_lecturer_name: subject.lecturer_name,
        day_of_week: row.day_of_week,
        start_time: row.start_time.slice(0, 5),
        end_time: row.end_time.slice(0, 5),
        room: row.room,
        lecturer_name: row.lecturer_name,
        class_name: klass.name,
        class_slug: klass.slug,
      },
    ];
  });
}

import "server-only";

import {
  SCHEDULE_COLLISION_ERROR_CODE,
  type ClassScheduleCreateInput,
  type ClassScheduleUpdateInput,
} from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import { DataAccessError } from "@/lib/db/assignments";
import { listMyClasses } from "@/lib/db/classes";
import { listUserCourseAccessMap } from "@/lib/db/course-access";
import {
  findScheduleCollisions,
  formatScheduleCollisionMessage,
  type TimeSlotCandidate,
} from "@/lib/schedule/collision";
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
  period: string | null;
  start_date: string | null;
  end_date: string | null;
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
      "id, subject_id, day_of_week, start_time, end_time, room, lecturer_name, period, start_date, end_date, class_subjects!class_course_schedules_subject_id_fkey ( name, lecturer_name )",
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
        period: row.period,
        start_date: row.start_date,
        end_date: row.end_date,
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

async function assertNoScheduleCollision(
  classId: string,
  candidate: TimeSlotCandidate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_course_schedules")
    .select(
      "id, class_id, day_of_week, start_time, end_time, room, lecturer_name, start_date, end_date",
    )
    .eq("class_id", classId)
    .eq("day_of_week", candidate.dayOfWeek);

  if (error) {
    throw new DataAccessError(
      "Could not validate schedule conflicts",
      error.code,
    );
  }

  const existing: TimeSlotCandidate[] = (data ?? []).map((row) => ({
    id: row.id,
    classId: row.class_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    room: row.room,
    lecturerName: row.lecturer_name,
    startDate: row.start_date,
    endDate: row.end_date,
  }));

  const conflicts = findScheduleCollisions(candidate, existing);
  const [firstConflict] = conflicts;

  if (firstConflict) {
    const message = formatScheduleCollisionMessage(firstConflict);

    throw new ApiError(409, SCHEDULE_COLLISION_ERROR_CODE, message, {
      startTime: message,
    });
  }
}

export async function createClassScheduleEntry(
  classId: string,
  userId: string,
  input: ClassScheduleCreateInput,
): Promise<string> {
  await requireSubjectInClass(classId, input.subjectId);
  await assertNoScheduleCollision(classId, {
    classId,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    room: input.room,
    lecturerName: input.lecturerName,
    startDate: input.startDate,
    endDate: input.endDate,
  });

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
      period: input.period ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error?.code === "23P01") {
    throw new ApiError(
      409,
      SCHEDULE_COLLISION_ERROR_CODE,
      "This time slot overlaps with an existing schedule entry.",
    );
  }

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
  await assertNoScheduleCollision(classId, {
    id: scheduleId,
    classId,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    room: input.room,
    lecturerName: input.lecturerName,
    startDate: input.startDate,
    endDate: input.endDate,
  });

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
      period: input.period ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
    })
    .eq("id", scheduleId)
    .eq("class_id", classId);

  if (error?.code === "23P01") {
    throw new ApiError(
      409,
      SCHEDULE_COLLISION_ERROR_CODE,
      "This time slot overlaps with an existing schedule entry.",
    );
  }

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

  const [accessMap, { data, error }] = await Promise.all([
    listUserCourseAccessMap(userId, classIds),
    supabase
      .from("class_course_schedules")
      .select(
        "id, class_id, subject_id, day_of_week, start_time, end_time, room, lecturer_name, period, start_date, end_date, classes!class_course_schedules_class_id_fkey ( name, slug ), class_subjects!class_course_schedules_subject_id_fkey ( name, lecturer_name )",
      )
      .in("class_id", classIds)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
  ]);

  if (error) {
    throw new DataAccessError(
      "Could not load your weekly schedule",
      error.code,
    );
  }

  return (data ?? []).flatMap((row) => {
    const access = accessMap.get(row.class_id);

    if (
      access?.scope === "selected" &&
      !access.allowedSubjectIds.has(row.subject_id)
    ) {
      return [];
    }

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
        period: row.period,
        start_date: row.start_date,
        end_date: row.end_date,
        class_name: klass.name,
        class_slug: klass.slug,
      },
    ];
  });
}

/**
 * Inserts the confirmed rows of one PDF import as a single statement, so a
 * failure leaves nothing behind instead of half a timetable. Every subject
 * is verified against the class before the insert.
 */
export async function createClassScheduleEntries(
  classId: string,
  userId: string,
  inputs: ClassScheduleCreateInput[],
): Promise<ClassScheduleEntry[]> {
  for (const subjectId of new Set(inputs.map((input) => input.subjectId))) {
    await requireSubjectInClass(classId, subjectId);
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_course_schedules")
    .insert(
      inputs.map((input) => ({
        class_id: classId,
        subject_id: input.subjectId,
        day_of_week: input.dayOfWeek,
        start_time: input.startTime,
        end_time: input.endTime,
        room: input.room ?? null,
        lecturer_name: input.lecturerName ?? null,
        period: input.period ?? null,
        start_date: input.startDate ?? null,
        end_date: input.endDate ?? null,
        created_by: userId,
      })),
    )
    .select(
      "id, subject_id, day_of_week, start_time, end_time, room, lecturer_name, period, start_date, end_date, class_subjects!class_course_schedules_subject_id_fkey ( name, lecturer_name )",
    );

  if (error) {
    throw new DataAccessError(
      "Could not import the schedule entries",
      error.code,
    );
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
        period: row.period,
        start_date: row.start_date,
        end_date: row.end_date,
      },
    ];
  });
}

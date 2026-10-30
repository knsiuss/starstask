import "server-only";

import type {
  CalendarEventStatus,
  ClassCalendarEventCreateInput,
  ClassCalendarEventUpdateInput,
  PersonalCalendarEventCreateInput,
  PersonalCalendarEventUpdateInput,
} from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireSubjectInClass(
  classId: string,
  subjectId: string | undefined,
): Promise<void> {
  if (!subjectId) {
    return;
  }

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

export async function createPersonalCalendarEvent(
  userId: string,
  input: PersonalCalendarEventCreateInput,
): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("personal_calendar_events")
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      time_zone: input.timeZone,
      location: input.location ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new DataAccessError(
      "Could not create the personal event",
      error?.code,
    );
  }

  return data.id;
}

export async function updatePersonalCalendarEvent(
  userId: string,
  eventId: string,
  input: PersonalCalendarEventUpdateInput,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("personal_calendar_events")
    .update({
      title: input.title,
      description: input.description ?? null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      time_zone: input.timeZone,
      location: input.location ?? null,
    })
    .eq("id", eventId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new DataAccessError(
      "Could not update the personal event",
      error.code,
    );
  }

  return Boolean(data);
}

export async function setPersonalCalendarEventStatus(
  userId: string,
  eventId: string,
  status: CalendarEventStatus,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("personal_calendar_events")
    .update({ status })
    .eq("id", eventId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new DataAccessError(
      "Could not change the personal event status",
      error.code,
    );
  }

  return Boolean(data);
}

export async function deletePersonalCalendarEvent(
  userId: string,
  eventId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("personal_calendar_events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new DataAccessError(
      "Could not delete the personal event",
      error.code,
    );
  }

  return Boolean(data);
}

export async function createClassCalendarEvent(
  classId: string,
  userId: string,
  input: ClassCalendarEventCreateInput,
): Promise<string> {
  await requireSubjectInClass(classId, input.subjectId);

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_calendar_events")
    .insert({
      class_id: classId,
      subject_id: input.subjectId ?? null,
      title: input.title,
      description: input.description ?? null,
      event_type: input.eventType,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      time_zone: input.timeZone,
      location: input.location ?? null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new DataAccessError(
      "Could not create the official event",
      error?.code,
    );
  }

  return data.id;
}

export async function updateClassCalendarEvent(
  classId: string,
  eventId: string,
  input: ClassCalendarEventUpdateInput,
): Promise<boolean> {
  await requireSubjectInClass(classId, input.subjectId);

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_calendar_events")
    .update({
      subject_id: input.subjectId ?? null,
      title: input.title,
      description: input.description ?? null,
      event_type: input.eventType,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      time_zone: input.timeZone,
      location: input.location ?? null,
    })
    .eq("id", eventId)
    .eq("class_id", classId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new DataAccessError(
      "Could not update the official event",
      error.code,
    );
  }

  return Boolean(data);
}

export async function setClassCalendarEventStatus(
  classId: string,
  eventId: string,
  status: CalendarEventStatus,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_calendar_events")
    .update({ status })
    .eq("id", eventId)
    .eq("class_id", classId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new DataAccessError(
      "Could not change the official event status",
      error.code,
    );
  }

  return Boolean(data);
}

/** Archiving is the delete path for official events; the row is preserved. */
export async function archiveClassCalendarEvent(
  classId: string,
  eventId: string,
): Promise<boolean> {
  return setClassCalendarEventStatus(classId, eventId, "archived");
}

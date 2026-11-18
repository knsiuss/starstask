import "server-only";

import { buildCalendarViewRange, todayDateKey } from "@starstask/shared";

import { selectActionCenterClasses } from "@/lib/classes/action-center";
import { DataAccessError } from "@/lib/db/assignments";
import { listMyClasses } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LecturerTodaySession = {
  id: string;
  classId: string;
  className: string;
  classSlug: string;
  classCode: string | null;
  title: string;
  /** UTC instant. */
  startsAtIso: string;
  /** UTC instant. */
  endsAtIso: string;
  /** discussion_sessions.session_type */
  sessionType: string;
  /** discussion_sessions.status */
  status: string;
  meetingUrl: string | null;
  location: string | null;
};

export type LecturerToday = {
  /** Asia/Jakarta YYYY-MM-DD */
  todayKey: string;
  /** Sessions on the Asia/Jakarta day, sorted by starts_at ascending. */
  sessions: LecturerTodaySession[];
};

type SessionClassEmbed = {
  name: string;
  slug: string;
  class_code: string | null;
};

type SessionRow = {
  id: string;
  class_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  session_type: string;
  status: string;
  meeting_url: string | null;
  location: string | null;
  classes: SessionClassEmbed | null;
};

/**
 * Today's teaching sessions for the classes the caller administers.
 *
 * Mirrors getClassActionCenter's access pattern: only active classes where the
 * caller is admin contribute rows. An empty admin list is a valid outcome, not
 * an error, so it returns an empty session list; a failed query throws.
 */
export async function getLecturerToday(
  userId: string,
  now: Date = new Date(),
): Promise<LecturerToday> {
  const classes = selectActionCenterClasses(await listMyClasses(userId));
  const todayKey = todayDateKey(now);
  const { fromIso, toIso } = buildCalendarViewRange("day", todayKey);

  if (classes.length === 0) {
    return { todayKey, sessions: [] };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("discussion_sessions")
    .select(
      "id, class_id, title, starts_at, ends_at, session_type, status, meeting_url, location, classes!discussion_sessions_class_id_fkey ( name, slug, class_code )",
    )
    .in(
      "class_id",
      classes.map((classItem) => classItem.id),
    )
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at", { ascending: true });

  if (error) {
    throw new DataAccessError(
      "Could not load today's teaching sessions",
      error.code,
    );
  }

  const rows = (data ?? []) as unknown as SessionRow[];

  return {
    todayKey,
    sessions: rows.map((row) => ({
      id: row.id,
      classId: row.class_id,
      className: row.classes?.name ?? "Unknown class",
      classSlug: row.classes?.slug ?? "",
      classCode: row.classes?.class_code ?? null,
      title: row.title,
      startsAtIso: row.starts_at,
      endsAtIso: row.ends_at,
      sessionType: row.session_type,
      status: row.status,
      meetingUrl: row.meeting_url,
      location: row.location,
    })),
  };
}

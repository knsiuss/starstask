import "server-only";

import { resolveAttendanceMeetingPhase } from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AttendanceMeetingCounts = {
  totalMeetings: number;
  openMeetings: number;
};

type MeetingCountRow = {
  class_id: string;
  ends_at: string;
  attendance_opened_at: string | null;
  attendance_closed_at: string | null;
  attendance_finalized_at: string | null;
  attendance_closes_at: string | null;
};

const MAX_ROWS = 5_000;

/**
 * Counts recorded meetings per class from already-fetched rows.
 *
 * The phase resolver drives `open` exactly as in the per-class meeting list,
 * so a grouped read reports the same open/total split without N per-class
 * round trips.
 */
export function summarizeMeetingCounts(
  rows: MeetingCountRow[],
  nowMs: number,
): Map<string, AttendanceMeetingCounts> {
  const counts = new Map<string, AttendanceMeetingCounts>();

  for (const row of rows) {
    const current = counts.get(row.class_id) ?? {
      totalMeetings: 0,
      openMeetings: 0,
    };

    current.totalMeetings += 1;

    const phase = resolveAttendanceMeetingPhase(
      {
        attendance_opened_at: row.attendance_opened_at,
        attendance_closed_at: row.attendance_closed_at,
        attendance_finalized_at: row.attendance_finalized_at,
        attendance_closes_at: row.attendance_closes_at,
        ends_at: row.ends_at,
      },
      nowMs,
    );

    if (phase === "open") {
      current.openMeetings += 1;
    }

    counts.set(row.class_id, current);
  }

  return counts;
}

/**
 * One grouped read for the lecturer attendance overview.
 *
 * Mirrors the `class_attendance_meeting_list` filter (attendance meetings
 * only, cancelled excluded, subject required) so the counts match the
 * per-class RPC list. Row visibility stays governed by
 * `can_view_session`; classes the caller cannot see are simply absent
 * from the result.
 */
export async function listAttendanceMeetingCountsForClasses(
  classIds: string[],
  now: Date = new Date(),
): Promise<Map<string, AttendanceMeetingCounts>> {
  if (classIds.length === 0) {
    return new Map();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("discussion_sessions")
    .select(
      "class_id, ends_at, attendance_opened_at, attendance_closed_at, attendance_finalized_at, attendance_closes_at",
    )
    .in("class_id", classIds)
    .not("meeting_number", "is", null)
    .not("subject_id", "is", null)
    .neq("status", "cancelled")
    .limit(MAX_ROWS);

  if (error) {
    throw new DataAccessError(
      "Could not load attendance meeting counts",
      error.code,
    );
  }

  return summarizeMeetingCounts(
    (data ?? []) as MeetingCountRow[],
    now.getTime(),
  );
}

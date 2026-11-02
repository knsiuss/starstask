import "server-only";

import { buildCalendarViewRange, todayDateKey } from "@starstask/shared";

import {
  selectActionCenterClasses,
  sortActionCenterRows,
  summarizeActionCenter,
  toActionCenterRow,
  type ActionCenterRow,
  type ActionCenterTotals,
} from "@/lib/classes/action-center";
import { DataAccessError } from "@/lib/db/assignments";
import { listMyClasses } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClassActionCenter = {
  rows: ActionCenterRow[];
  totals: ActionCenterTotals;
  /** Asia/Jakarta date the "today" column was counted for. */
  todayKey: string;
};

type CountQuery = PromiseLike<{
  count: number | null;
  error: { code?: string } | null;
}>;

async function countRows(query: CountQuery, message: string): Promise<number> {
  const { count, error } = await query;

  if (error) {
    throw new DataAccessError(message, error.code);
  }

  return count ?? 0;
}

/**
 * Everything waiting on the caller across the active classes they lead.
 *
 * Counts come from head requests, so no row leaves the database just to be
 * counted. RLS already scopes every table to classes the caller manages; the
 * filters here only turn each table into its queue.
 */
export async function getClassActionCenter(
  userId: string,
  now: Date = new Date(),
): Promise<ClassActionCenter> {
  const classes = selectActionCenterClasses(await listMyClasses(userId));
  const todayKey = todayDateKey(now);
  const { fromIso, toIso } = buildCalendarViewRange("day", todayKey);

  if (classes.length === 0) {
    return { rows: [], totals: summarizeActionCenter([]), todayKey };
  }

  const supabase = await createSupabaseServerClient();

  const rows = await Promise.all(
    classes.map(async (classItem) => {
      const [pendingSubmissions, pendingLeave, todaysSessions, openReports] =
        await Promise.all([
          countRows(
            supabase
              .from("assignments")
              .select("id", { count: "exact", head: true })
              .eq("class_id", classItem.id)
              .eq("status", "pending_review"),
            "Could not count submissions awaiting review",
          ),
          countRows(
            supabase
              .from("leave_requests")
              .select("id", { count: "exact", head: true })
              .eq("class_id", classItem.id)
              .eq("status", "submitted"),
            "Could not count absence requests",
          ),
          countRows(
            supabase
              .from("discussion_sessions")
              .select("id", { count: "exact", head: true })
              .eq("class_id", classItem.id)
              .eq("status", "scheduled")
              .gte("starts_at", fromIso)
              .lt("starts_at", toIso),
            "Could not count today's sessions",
          ),
          countRows(
            supabase
              .from("assignment_reports")
              .select("id", { count: "exact", head: true })
              .eq("class_id", classItem.id)
              .eq("status", "open"),
            "Could not count open reader reports",
          ),
        ]);

      return toActionCenterRow(classItem, {
        pendingSubmissions,
        pendingLeave,
        todaysSessions,
        openReports,
      });
    }),
  );

  return {
    rows: sortActionCenterRows(rows),
    totals: summarizeActionCenter(rows),
    todayKey,
  };
}

import "server-only";

import { buildCalendarViewRange, todayDateKey } from "@starstask/shared";

import {
  mergeActionCounts,
  selectActionCenterClasses,
  sortActionCenterRows,
  summarizeActionCenter,
  toActionCenterRow,
  type ActionCenterRow,
  type ActionCenterTotals,
  type ActionCounts,
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

type ClassActionCountRow = {
  class_id: string;
  pending_submissions: number;
  pending_leave: number;
  todays_sessions: number;
  open_reports: number;
};

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
 * Counts come from one grouped RPC roundtrip where possible, so no row
 * leaves the database just to be counted. The RPC re-checks class
 * administration via auth.uid(); RLS still scopes the legacy fallback.
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

  const rows = await loadActionRows(supabase, classes, fromIso, toIso);

  return {
    rows: sortActionCenterRows(rows),
    totals: summarizeActionCenter(rows),
    todayKey,
  };
}

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function loadActionRows(
  supabase: ServerClient,
  classes: ReturnType<typeof selectActionCenterClasses>,
  fromIso: string,
  toIso: string,
): Promise<ActionCenterRow[]> {
  const rpcRows = await loadActionCountsViaRpc(
    supabase,
    classes,
    fromIso,
    toIso,
  );

  if (rpcRows) {
    return mergeActionCounts(classes, rpcRows);
  }

  return loadActionRowsLegacy(supabase, classes, fromIso, toIso);
}

async function loadActionCountsViaRpc(
  supabase: ServerClient,
  classes: ReturnType<typeof selectActionCenterClasses>,
  fromIso: string,
  toIso: string,
): Promise<Map<string, ActionCounts> | null> {
  const { data, error } = await supabase.rpc(
    "get_class_action_counts" as never,
    {
      p_class_ids: classes.map((classItem) => classItem.id),
      p_from: fromIso,
      p_to: toIso,
    } as never,
  );

  if (error || !data) {
    return null;
  }

  const countsByClassId = new Map<string, ActionCounts>();

  for (const row of data as unknown as ClassActionCountRow[]) {
    countsByClassId.set(row.class_id, {
      pendingSubmissions: row.pending_submissions,
      pendingLeave: row.pending_leave,
      todaysSessions: row.todays_sessions,
      openReports: row.open_reports,
    });
  }

  return countsByClassId;
}

async function loadActionRowsLegacy(
  supabase: ServerClient,
  classes: ReturnType<typeof selectActionCenterClasses>,
  fromIso: string,
  toIso: string,
): Promise<ActionCenterRow[]> {
  return Promise.all(
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
}

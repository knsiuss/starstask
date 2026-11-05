import "server-only";

import {
  DASHBOARD_CACHE_TAG,
  invalidateCacheTag,
} from "@/lib/cache/redis-cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { DataAccessError } from "./assignments";

/**
 * Personal completion tracking.
 *
 * A completion mark belongs to one student and one assignment. It never touches
 * the assignment row and never represents a submission, a grade, or anything a
 * lecturer sees — it exists so a student can tick off their own work.
 *
 * The table's RLS policies already restrict reads and writes to the caller's
 * own rows, and inserts additionally require published status plus active class
 * membership. The checks here exist to turn a silent zero-row write into a
 * clear error.
 */

export async function loadCompletionIds(
  userId: string,
  assignmentIds: readonly string[],
): Promise<Set<string>> {
  if (assignmentIds.length === 0) {
    return new Set();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignment_completions")
    .select("assignment_id")
    .eq("user_id", userId)
    .in("assignment_id", [...assignmentIds]);

  if (error) {
    throw new DataAccessError(
      "Could not load your completion marks",
      error.code,
    );
  }

  return new Set((data ?? []).map((row) => row.assignment_id));
}

export async function setAssignmentCompletion(
  userId: string,
  assignmentId: string,
  completed: boolean,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  if (!completed) {
    const { error } = await supabase
      .from("assignment_completions")
      .delete()
      .eq("user_id", userId)
      .eq("assignment_id", assignmentId);

    if (error) {
      throw new DataAccessError("Could not clear that mark", error.code);
    }

    await invalidateCacheTag(DASHBOARD_CACHE_TAG);
    return;
  }

  const { error } = await supabase
    .from("assignment_completions")
    .upsert(
      { assignment_id: assignmentId, user_id: userId },
      { onConflict: "assignment_id,user_id", ignoreDuplicates: true },
    );

  if (error) {
    // A policy rejection means the assignment is not published, is not in one
    // of the caller's classes, or does not exist. All three are the same
    // answer to the caller: this assignment cannot be marked.
    if (error.code === "42501" || error.code === "23503") {
      throw new DataAccessError(
        "That assignment cannot be marked as done",
        "not_allowed",
      );
    }

    throw new DataAccessError("Could not save that mark", error.code);
  }

  await invalidateCacheTag(DASHBOARD_CACHE_TAG);
}

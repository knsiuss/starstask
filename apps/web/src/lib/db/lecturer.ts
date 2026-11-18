import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DataAccessError } from "@/lib/db/assignments";
import { listMyClassDirectory } from "@/lib/db/classes";

export type LecturerClass = {
  id: string;
  slug: string;
  name: string;
  class_code: string | null;
  course_name: string;
  semester: string;
  academic_year: string;
  status: string;
  member_count: number;
  task_count: number;
  published_count: number;
};

export type LecturerOverview = {
  classCount: number;
  memberCount: number;
  /** Tasks authored by the caller in classes they administer. */
  taskCount: number;
  publishedCount: number;
  classes: LecturerClass[];
};

/**
 * Reads the lecturer dashboard: classes the caller administers (class_admins)
 * with roster size and per-class task counts authored by the caller.
 *
 * Visibility comes from RLS on `class_members` and `class_admins`; both are
 * read by the caller's own rows. Counts use PostgREST head-count queries, one
 * per class pair. Fails closed with a DataAccessError on query failure so the
 * page renders as an error, never as "no classes".
 */
export async function getLecturerOverview(
  userId: string,
): Promise<LecturerOverview> {
  const supabase = await createSupabaseServerClient();

  const directory = await listMyClassDirectory(userId);
  const activeRows = directory.filter((row) => row.status === "active");

  if (activeRows.length === 0) {
    return {
      classCount: 0,
      memberCount: 0,
      taskCount: 0,
      publishedCount: 0,
      classes: [],
    };
  }

  const adminIds = activeRows.map((row) => row.id);
  const { data: authoredAssignments, error: countError } = await supabase
    .from("assignments")
    .select("class_id, status")
    .eq("user_id", userId)
    .in("class_id", adminIds)
    .limit(5000);

  if (countError) {
    throw new DataAccessError(
      "Could not count your lecturer tasks",
      countError.code,
    );
  }

  const perClassMap = new Map<
    string,
    { task_count: number; published_count: number }
  >();

  for (const row of authoredAssignments ?? []) {
    if (!row.class_id) continue;
    const current = perClassMap.get(row.class_id) ?? {
      task_count: 0,
      published_count: 0,
    };
    current.task_count += 1;
    if (row.status === "published") {
      current.published_count += 1;
    }
    perClassMap.set(row.class_id, current);
  }

  const classes: LecturerClass[] = activeRows
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      class_code: row.class_code,
      course_name: row.course_name,
      semester: row.semester,
      academic_year: row.academic_year,
      status: row.status,
      member_count: row.member_count,
      task_count: perClassMap.get(row.id)?.task_count ?? 0,
      published_count: perClassMap.get(row.id)?.published_count ?? 0,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    classCount: classes.length,
    memberCount: classes.reduce((sum, row) => sum + row.member_count, 0),
    taskCount: classes.reduce((sum, row) => sum + row.task_count, 0),
    publishedCount: classes.reduce((sum, row) => sum + row.published_count, 0),
    classes,
  };
}

import "server-only";

import { loadCompletionIds } from "@/lib/db/assignment-completions";
import { DataAccessError } from "@/lib/db/assignments";
import { loadProfiles } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDeadlineState } from "@starstask/shared";

/**
 * Class Overview aggregation. Every number on the Overview tab comes from
 * these reads, so the header, the stats card, and the lists can never
 * disagree with each other — and they read the same assignment rows the
 * Assignments workspace, Schedule, and Dashboard consume.
 */

export type OverviewAssignment = {
  id: string;
  title: string;
  course_name: string;
  course_code: string | null;
  deadline: string | null;
  published_at: string | null;
  created_at: string;
  /** The viewer personally ticked this assignment off. */
  completed: boolean;
};

export type OverviewPost = {
  id: string;
  title: string;
  description: string;
  published_at: string | null;
  created_at: string;
  author_name: string;
};

export type ClassOverviewStats = {
  total: number;
  upcoming: number;
  dueToday: number;
  /** The viewer's own completion marks inside this class's published set. */
  completed: number;
};

export type ClassOverviewData = {
  recent: OverviewAssignment[];
  posts: OverviewPost[];
  stats: ClassOverviewStats;
};

const RECENT_LIMIT = 5;
const POSTS_LIMIT = 5;
// Bounds the in-memory merge; one class's published set stays far under this.
const FETCH_LIMIT = 500;

type OverviewRow = {
  id: string;
  title: string;
  description: string;
  content_type: string;
  deadline: string | null;
  published_at: string | null;
  created_at: string;
  course_id: string | null;
  user_id: string;
  courses: { name: string; code: string | null } | null;
};

const OVERVIEW_COLUMNS =
  "id, title, description, content_type, deadline, published_at, created_at, course_id, user_id, courses!assignments_course_id_fkey ( name, code )";

/** Published rows visible in one class: its own rows plus the public tasks of its catalog courses. */
export async function getClassOverviewData(
  classId: string,
  userId: string,
): Promise<ClassOverviewData> {
  const supabase = await createSupabaseServerClient();

  const { data: subjectRows, error: subjectError } = await supabase
    .from("class_subjects")
    .select("course_id")
    .eq("class_id", classId);

  if (subjectError) {
    throw new DataAccessError("Could not load the class", subjectError.code);
  }

  const courseIds = [
    ...new Set(
      (subjectRows ?? [])
        .map((row) => row.course_id)
        .filter((courseId): courseId is string => Boolean(courseId)),
    ),
  ];

  const [scoped, publicRows] = await Promise.all([
    supabase
      .from("assignments")
      .select(OVERVIEW_COLUMNS)
      .eq("class_id", classId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT),
    courseIds.length > 0
      ? supabase
          .from("assignments")
          .select(OVERVIEW_COLUMNS)
          .is("class_id", null)
          .is("subject_id", null)
          .in("course_id", courseIds)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(FETCH_LIMIT)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [scoped, publicRows]) {
    if (result.error) {
      throw new DataAccessError(
        "Could not load the class overview",
        result.error.code,
      );
    }
  }

  const seen = new Set<string>();
  const rows = (
    [...(scoped.data ?? []), ...(publicRows.data ?? [])] as OverviewRow[]
  ).filter((row) => {
    if (seen.has(row.id)) {
      return false;
    }

    seen.add(row.id);
    return true;
  });

  const assignments = rows.filter(
    (row) => row.content_type !== "class_announcement",
  );
  const announcements = rows.filter(
    (row) => row.content_type === "class_announcement",
  );

  const now = new Date();
  let upcoming = 0;
  let dueToday = 0;

  for (const row of assignments) {
    const state = getDeadlineState(row.deadline, now);

    if (state === "upcoming") {
      upcoming += 1;
    } else if (state === "due_today") {
      dueToday += 1;
    }
  }

  const completedIds = await loadCompletionIds(
    userId,
    assignments.map((row) => row.id),
  );

  const recent = [...assignments]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, RECENT_LIMIT)
    .map((row) => ({
      id: row.id,
      title: row.title,
      course_name: row.courses?.name ?? "Unknown course",
      course_code: row.courses?.code ?? null,
      deadline: row.deadline,
      published_at: row.published_at,
      created_at: row.created_at,
      completed: completedIds.has(row.id),
    }));

  const postRows = [...announcements]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, POSTS_LIMIT);
  const profiles = await loadProfiles(postRows.map((row) => row.user_id));

  const posts = postRows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    published_at: row.published_at,
    created_at: row.created_at,
    author_name: profiles.get(row.user_id)?.display_name ?? "StarsTask member",
  }));

  return {
    recent,
    posts,
    stats: {
      total: assignments.length,
      upcoming,
      dueToday,
      completed: completedIds.size,
    },
  };
}

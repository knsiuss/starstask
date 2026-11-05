import "server-only";

import type { MemberAssignmentsQuery } from "@starstask/contracts";
import {
  LEAVE_REASON_LABELS,
  LEAVE_STATUS_LABELS,
  type LeaveReasonCategory,
  type LeaveRequestStatus,
} from "@starstask/contracts";
import {
  APP_TIME_ZONE_OFFSET,
  getDueSoonWindow,
  isKnownTimeZone,
  toJakartaDateKey,
} from "@starstask/shared";

import {
  DASHBOARD_CACHE_TAG,
  DASHBOARD_CACHE_TTL_SECONDS,
  getCachedWithTag,
} from "@/lib/cache/redis-cache";
import { DataAccessError, type PaginatedResult } from "@/lib/db/assignments";
import { loadCompletionIds } from "@/lib/db/assignment-completions";
import { listMyClasses, loadProfiles } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AssignmentListItem } from "@/types/database";

export type DashboardClass = {
  id: string;
  slug: string;
  name: string;
  course_name: string;
  semester: string;
  academic_year: string;
  task_count: number;
  is_admin: boolean;
  subject_count: number;
  admin_name: string | null;
};

export type MemberAssignmentList = PaginatedResult<AssignmentListItem> & {
  activeClassCount: number;
};

export type DashboardTask = {
  id: string;
  title: string;
  deadline: string | null;
  class_name: string;
};

export type DashboardStats = {
  totalTasks: number;
  dueSoon: number;
  pastDeadline: number;
  classCount: number;
  /** Assignments published in the caller's classes during the last 7 days. */
  newThisWeek: number;
};

export type DashboardOverview = {
  classes: DashboardClass[];
  stats: DashboardStats;
  recentTasks: DashboardTask[];
  /** Stored notification timezone when it is a valid IANA zone. */
  timeZone: string | null;
  nowIso: string;
};

const RECENT_TASK_LIMIT = 5;

/**
 * Reads the member dashboard from records the caller is already allowed to see.
 *
 * Tasks are published assignments in the caller's active classes. A deadline
 * that has passed is reported as a "past deadline" unless the student has
 * already ticked it as done, since the schema has no submitted-work state.
 *
 * The result is cached briefly in Redis (per user, short TTL); a cache miss
 * or outage falls back to the database reads below.
 */
export async function getDashboardOverview(
  userId: string,
): Promise<DashboardOverview> {
  return getCachedWithTag(
    DASHBOARD_CACHE_TAG,
    `dashboard:${userId}`,
    DASHBOARD_CACHE_TTL_SECONDS,
    () => loadDashboardOverview(userId),
  );
}

async function loadDashboardOverview(
  userId: string,
): Promise<DashboardOverview> {
  // Fast path: 1 RPC roundtrip (20261126000000). Falls back to legacy multi-query on error.
  try {
    const supabaseRpc = await createSupabaseServerClient();
    const { data, error } = await supabaseRpc.rpc(
      "get_dashboard_overview" as never,
      { p_user_id: userId } as never,
    );
    if (!error && data) {
      const d = data as unknown as {
        classes: DashboardClass[];
        stats: DashboardStats;
        recentTasks: DashboardTask[];
        timeZone: string | null;
        nowIso: string;
      };
      return {
        classes: d.classes ?? [],
        stats: d.stats,
        recentTasks: (d.recentTasks ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          deadline: t.deadline,
          class_name: t.class_name,
        })),
        timeZone: d.timeZone,
        nowIso: d.nowIso,
      };
    }
  } catch {
    // fall through to legacy path
  }
  const now = new Date();
  const nowIso = now.toISOString();
  const dueSoonWindow = getDueSoonWindow(now);
  const dueSoonStartIso = dueSoonWindow.start.toISOString();
  const dueSoonEndIso = dueSoonWindow.end.toISOString();

  const supabase = await createSupabaseServerClient();

  const [memberships, preferences] = await Promise.all([
    listMyClasses(userId),
    supabase
      .from("notification_preferences")
      .select("timezone")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (preferences.error) {
    throw new DataAccessError(
      "Could not load your timezone",
      preferences.error.code,
    );
  }

  const storedTimeZone = preferences.data?.timezone ?? null;
  const timeZone =
    storedTimeZone && isKnownTimeZone(storedTimeZone) ? storedTimeZone : null;

  const activeClasses = memberships.filter(
    (classItem) => classItem.status === "active",
  );
  const classIds = activeClasses.map((classItem) => classItem.id);

  if (classIds.length === 0) {
    return {
      classes: [],
      stats: {
        totalTasks: 0,
        dueSoon: 0,
        pastDeadline: 0,
        classCount: 0,
        newThisWeek: 0,
      },
      recentTasks: [],
      timeZone,
      nowIso,
    };
  }

  // A class also sees the public assignments of its catalog courses: rows
  // with no class/subject yet, matched by `course_id` (same rule the class
  // pages use). Counting only by `class_id` hides every such task.
  const { data: subjectRows, error: subjectError } = await supabase
    .from("class_subjects")
    .select("class_id, course_id")
    .in("class_id", classIds);

  if (subjectError) {
    throw new DataAccessError(
      "Could not load your class subjects",
      subjectError.code,
    );
  }

  const courseIdsByClass = new Map<string, Set<string>>();

  for (const row of subjectRows ?? []) {
    if (!row.course_id) {
      continue;
    }

    const bucket = courseIdsByClass.get(row.class_id) ?? new Set<string>();
    bucket.add(row.course_id);
    courseIdsByClass.set(row.class_id, bucket);
  }

  const classCourseIds = [...courseIdsByClass.values()].flatMap((ids) => [
    ...ids,
  ]);
  const allCourseIds = [...new Set(classCourseIds)];

  const countPublishedTasks = (ids: string[] = classIds) =>
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .in("class_id", ids)
      .eq("status", "published");

  const countPublicTasks = () =>
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .is("class_id", null)
      .is("subject_id", null)
      .eq("status", "published")
      .in("course_id", allCourseIds);

  const countPublicForClass = (classItem: (typeof activeClasses)[number]) => {
    const ids = [...(courseIdsByClass.get(classItem.id) ?? [])];

    if (ids.length === 0) {
      return Promise.resolve({ count: 0, error: null });
    }

    return supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .is("class_id", null)
      .is("subject_id", null)
      .eq("status", "published")
      .in("course_id", ids);
  };

  const countAllTasks = (ids: string[]) =>
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .in("class_id", ids);

  /** Tasks the caller can actually see in a class: admins see drafts too. */
  const countVisibleTasks = async (
    classItem: (typeof activeClasses)[number],
  ): Promise<{ count: number | null; error: { code?: string } | null }> => {
    const scoped = await (classItem.is_admin
      ? countAllTasks([classItem.id])
      : countPublishedTasks([classItem.id]));

    if (scoped.error) {
      return { count: null, error: scoped.error };
    }

    const publicCount = await countPublicForClass(classItem);

    if (publicCount.error) {
      return { count: null, error: publicCount.error };
    }

    return {
      count: (scoped.count ?? 0) + (publicCount.count ?? 0),
      error: null,
    };
  };

  const pastDeadlineIds = () =>
    supabase
      .from("assignments")
      .select("id")
      .in("class_id", classIds)
      .eq("status", "published")
      .lt("deadline", dueSoonStartIso)
      .limit(5_000);

  const publicPastDeadlineIds = () =>
    supabase
      .from("assignments")
      .select("id")
      .is("class_id", null)
      .is("subject_id", null)
      .eq("status", "published")
      .lt("deadline", dueSoonStartIso)
      .in("course_id", allCourseIds)
      .limit(5_000);

  const recentScoped = () =>
    supabase
      .from("assignments")
      .select(
        "id, title, deadline, published_at, classes!assignments_class_id_fkey ( name )",
      )
      .in("class_id", classIds)
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(RECENT_TASK_LIMIT);

  const recentPublic = () =>
    supabase
      .from("assignments")
      .select(
        "id, title, deadline, published_at, courses!assignments_course_id_fkey ( name )",
      )
      .is("class_id", null)
      .is("subject_id", null)
      .eq("status", "published")
      .in("course_id", allCourseIds)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(RECENT_TASK_LIMIT);

  // Scoped tasks (owned by the class row) plus the same class's public
  // course tasks. The public half is skipped entirely when no catalog
  // courses link the caller's classes to public rows.
  const hasPublic = allCourseIds.length > 0;
  const noneCount = Promise.resolve({ count: 0, error: null });
  const noneRows = Promise.resolve({ data: [], error: null });

  const [
    dueSoonScoped,
    dueSoonPublic,
    pastScoped,
    pastPublic,
    newScoped,
    newPublic,
    recentScopedResult,
    recentPublicResult,
  ] = await Promise.all([
    // The half-open WIB window is shared with the deadline badges: today
    // through the next seven calendar days.
    countPublishedTasks()
      .gte("deadline", dueSoonStartIso)
      .lt("deadline", dueSoonEndIso),
    hasPublic
      ? countPublicTasks()
          .gte("deadline", dueSoonStartIso)
          .lt("deadline", dueSoonEndIso)
      : noneCount,
    pastDeadlineIds(),
    hasPublic ? publicPastDeadlineIds() : noneRows,
    countPublishedTasks().gte(
      "published_at",
      new Date(now.getTime() - 7 * 86_400_000).toISOString(),
    ),
    hasPublic
      ? countPublicTasks().gte(
          "published_at",
          new Date(now.getTime() - 7 * 86_400_000).toISOString(),
        )
      : noneCount,
    recentScoped(),
    hasPublic ? recentPublic() : noneRows,
  ]);

  const dueSoonResult = {
    count: (dueSoonScoped.count ?? 0) + (dueSoonPublic.count ?? 0),
    error: dueSoonScoped.error ?? dueSoonPublic.error,
  };
  const pastDeadlineResult = {
    data: [...(pastScoped.data ?? []), ...(pastPublic.data ?? [])],
    error: pastScoped.error ?? pastPublic.error,
  };
  const newTasksResult = {
    count: (newScoped.count ?? 0) + (newPublic.count ?? 0),
    error: newScoped.error ?? newPublic.error,
  };
  const mergedRecent = [
    ...(recentScopedResult.data ?? []),
    ...(recentPublicResult.data ?? []),
  ]
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
    .slice(0, RECENT_TASK_LIMIT);
  const recentTasksResult = {
    data: mergedRecent,
    error: recentScopedResult.error ?? recentPublicResult.error,
  };

  const failures = [
    { result: dueSoonResult, message: "Could not count due tasks" },
    { result: pastDeadlineResult, message: "Could not count past deadlines" },
    { result: newTasksResult, message: "Could not count new tasks" },
    { result: recentTasksResult, message: "Could not load recent tasks" },
  ];

  for (const failure of failures) {
    if (failure.result.error) {
      throw new DataAccessError(failure.message, failure.result.error.code);
    }
  }

  // PostgREST exposes no grouped count, and a dedicated RPC would require a
  // migration the live project does not have yet. One bounded count per active
  // class stays correct and uses `head: true`, so no rows cross the wire.
  const classCountResults = await Promise.all(
    activeClasses.map((classItem) => countVisibleTasks(classItem)),
  );

  const classes: DashboardClass[] = activeClasses.map((classItem, index) => {
    const result = classCountResults[index];

    if (result?.error) {
      throw new DataAccessError(
        "Could not count class tasks",
        result.error.code,
      );
    }

    return {
      id: classItem.id,
      slug: classItem.slug,
      name: classItem.name,
      course_name: classItem.course_name,
      semester: classItem.semester,
      academic_year: classItem.academic_year,
      task_count: result?.count ?? 0,
      is_admin: classItem.is_admin,
      subject_count: classItem.subject_count ?? 0,
      admin_name: classItem.admin_name ?? null,
    };
  });

  const totalTasks = classes.reduce(
    (total, classItem) => total + classItem.task_count,
    0,
  );

  // Past-deadline tasks the student already ticked as done are not "needs
  // attention", so the raw count is reduced by their completion marks.
  const pastDeadlineRows = pastDeadlineResult.data ?? [];
  const completedPastIds = await loadCompletionIds(
    userId,
    pastDeadlineRows.map((row) => row.id),
  );

  const recentTasks: DashboardTask[] = (recentTasksResult.data ?? []).flatMap(
    (row) => {
      const className =
        "classes" in row && row.classes
          ? row.classes.name
          : "courses" in row && row.courses
            ? row.courses.name
            : null;

      if (!className) {
        return [];
      }

      return [
        {
          id: row.id,
          title: row.title,
          deadline: row.deadline,
          class_name: className,
        },
      ];
    },
  );

  return {
    classes,
    stats: {
      totalTasks,
      dueSoon: dueSoonResult.count ?? 0,
      pastDeadline: Math.max(
        0,
        pastDeadlineRows.length - completedPastIds.size,
      ),
      classCount: activeClasses.length,
      newThisWeek: newTasksResult.count ?? 0,
    },
    recentTasks,
    timeZone,
    nowIso,
  };
}

const PRIORITY_TASK_LIMIT = 5;
const PRIORITY_OVERDUE_LIMIT = 2;

export type DashboardPriorityTask = {
  id: string;
  title: string;
  deadline: string;
  className: string;
};

/**
 * The caller's most urgent tasks: overdue work first, then the closest
 * upcoming deadlines. Only published assignments from the caller's active
 * classes are read; submission rows and other students' data are never part of
 * this query.
 */
export async function listPriorityTasks(
  userId: string,
  now: Date = new Date(),
): Promise<DashboardPriorityTask[]> {
  const memberships = await listMyClasses(userId);
  const classIds = memberships
    .filter((classItem) => classItem.status === "active")
    .map((classItem) => classItem.id);

  if (classIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const nowIso = now.toISOString();
  const columns =
    "id, title, deadline, classes!assignments_class_id_fkey ( name )";

  const [overdueResult, upcomingResult] = await Promise.all([
    supabase
      .from("assignments")
      .select(columns)
      .in("class_id", classIds)
      .eq("status", "published")
      .not("deadline", "is", null)
      .lt("deadline", nowIso)
      .order("deadline", { ascending: true })
      .limit(PRIORITY_TASK_LIMIT),
    supabase
      .from("assignments")
      .select(columns)
      .in("class_id", classIds)
      .eq("status", "published")
      .not("deadline", "is", null)
      .gte("deadline", nowIso)
      .order("deadline", { ascending: true })
      .limit(PRIORITY_TASK_LIMIT),
  ]);

  const failures = [
    { result: overdueResult, message: "Could not load overdue tasks" },
    { result: upcomingResult, message: "Could not load upcoming tasks" },
  ];

  for (const failure of failures) {
    if (failure.result.error) {
      throw new DataAccessError(failure.message, failure.result.error.code);
    }
  }

  const rows = [
    ...(overdueResult.data ?? []).slice(0, PRIORITY_OVERDUE_LIMIT),
    ...(upcomingResult.data ?? []),
  ];

  return rows
    .flatMap((row) => {
      if (!row.deadline || !row.classes) {
        return [];
      }

      return [
        {
          id: row.id,
          title: row.title,
          deadline: row.deadline,
          className: row.classes.name,
        },
      ];
    })
    .slice(0, PRIORITY_TASK_LIMIT);
}

export type NextScheduleItem = {
  kind: "assignment" | "session";
  title: string;
  className: string;
  /** Sortable instant: deadline for tasks, start for sessions. */
  at: string;
  endsAt: string | null;
  href: string;
  detail: string;
};

/**
 * The nearest upcoming task deadline or session start at or after `now`.
 * Both sources include the class's public course tasks, so this card stays
 * in step with the stats and My week.
 */
export async function getNextSchedule(
  userId: string,
  now: Date = new Date(),
): Promise<NextScheduleItem | null> {
  const memberships = await listMyClasses(userId);
  const classIds = memberships
    .filter((classItem) => classItem.status === "active")
    .map((classItem) => classItem.id);

  if (classIds.length === 0) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const nowIso = now.toISOString();

  const { data: subjectCourseRows } = await supabase
    .from("class_subjects")
    .select("course_id")
    .in("class_id", classIds);

  const courseIds = [
    ...new Set(
      (subjectCourseRows ?? [])
        .map((row) => row.course_id)
        .filter((courseId): courseId is string => Boolean(courseId)),
    ),
  ];

  const [scopedTasks, publicTasks, sessions] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, title, deadline, classes!assignments_class_id_fkey ( name )")
      .in("class_id", classIds)
      .eq("status", "published")
      .not("deadline", "is", null)
      .gte("deadline", nowIso)
      .order("deadline", { ascending: true })
      .limit(5),
    courseIds.length > 0
      ? supabase
          .from("assignments")
          .select(
            "id, title, deadline, courses!assignments_course_id_fkey ( name )",
          )
          .is("class_id", null)
          .is("subject_id", null)
          .eq("status", "published")
          .not("deadline", "is", null)
          .in("course_id", courseIds)
          .gte("deadline", nowIso)
          .order("deadline", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("discussion_sessions")
      .select(
        "id, title, starts_at, ends_at, session_type, classes!discussion_sessions_class_id_fkey ( name )",
      )
      .in("class_id", classIds)
      .eq("status", "scheduled")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(5),
  ]);

  const failures = [
    { result: scopedTasks, message: "Could not load next tasks" },
    { result: publicTasks, message: "Could not load next tasks" },
    { result: sessions, message: "Could not load next sessions" },
  ];

  for (const failure of failures) {
    if (failure.result.error) {
      throw new DataAccessError(failure.message, failure.result.error.code);
    }
  }

  const candidates: NextScheduleItem[] = [
    ...(scopedTasks.data ?? []).flatMap((row) =>
      row.deadline && row.classes
        ? [
            {
              kind: "assignment" as const,
              title: row.title,
              className: row.classes.name,
              at: row.deadline,
              endsAt: null,
              href: `/assignments/${row.id}`,
              detail: "Deadline",
            },
          ]
        : [],
    ),
    ...(publicTasks.data ?? []).flatMap((row) =>
      row.deadline && row.courses
        ? [
            {
              kind: "assignment" as const,
              title: row.title,
              className: row.courses.name,
              at: row.deadline,
              endsAt: null,
              href: `/assignments/${row.id}`,
              detail: "Deadline",
            },
          ]
        : [],
    ),
    ...(sessions.data ?? []).map((row) => ({
      kind: "session" as const,
      title: row.title,
      className: row.classes?.name ?? "Class",
      at: row.starts_at,
      endsAt: row.ends_at,
      href: `/sessions/${row.id}`,
      detail: row.session_type === "online" ? "Online session" : "Session",
    })),
  ];

  candidates.sort((a, b) => a.at.localeCompare(b.at));

  return candidates[0] ?? null;
}

/**
 * Published assignments across every active class the caller belongs to.
 * Class memberships are read first, so the query can never widen beyond the
 * caller's own classes even before row-level security is applied.
 */
export async function listMemberPublishedAssignments(
  userId: string,
  query: MemberAssignmentsQuery,
): Promise<MemberAssignmentList> {
  const memberships = await listMyClasses(userId);
  const classIds = memberships
    .filter((classItem) => classItem.status === "active")
    .map((classItem) => classItem.id);
  const offset = (query.page - 1) * query.pageSize;

  if (classIds.length === 0) {
    return {
      items: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: 1,
      activeClassCount: 0,
    };
  }

  const supabase = await createSupabaseServerClient();
  const dueSoonWindow = getDueSoonWindow();
  const dueSoonStartIso = dueSoonWindow.start.toISOString();
  const dueSoonEndIso = dueSoonWindow.end.toISOString();

  let request = supabase
    .from("assignments")
    .select(
      "id, title, description, course_id, class_id, user_id, lecturer_name, semester, academic_year, assignment_type, content_type, source_label, drive_url, deadline, tags, created_at, updated_at, courses!assignments_course_id_fkey ( name, code ), assignment_attachments ( id )",
      { count: "exact" },
    )
    .in("class_id", classIds)
    .eq("status", "published");

  if (query.due === "soon") {
    request = request
      .gte("deadline", dueSoonStartIso)
      .lt("deadline", dueSoonEndIso);
  } else if (query.due === "overdue") {
    request = request.lt("deadline", dueSoonStartIso);
  }

  const { data, error, count } = await request
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + query.pageSize - 1);

  if (error) {
    throw new DataAccessError("Could not load your class tasks", error.code);
  }

  const rows = data ?? [];
  const profiles = await loadProfiles(rows.map((row) => row.user_id));
  const total = count ?? 0;

  // Personal completion marks are read in one extra query so the list stays a
  // single page of assignments. A missing row simply means "not marked".
  const completedIds = await loadCompletionIds(
    userId,
    rows.map((row) => row.id),
  );

  return {
    items: rows.map((row) => {
      const profile = profiles.get(row.user_id);

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        course_id: row.course_id,
        class_id: row.class_id,
        course_name: row.courses?.name ?? "Unknown course",
        course_code: row.courses?.code ?? null,
        lecturer_name: row.lecturer_name,
        semester: row.semester,
        academic_year: row.academic_year,
        assignment_type: row.assignment_type,
        content_type: row.content_type,
        source_label: row.source_label,
        drive_url: row.drive_url,
        completed: completedIds.has(row.id),
        deadline: row.deadline,
        tags: row.tags ?? [],
        created_at: row.created_at,
        updated_at: row.updated_at,
        author_display_name: profile?.display_name ?? "StarsTask member",
        author_avatar_url: profile?.avatar_url ?? null,
        attachment_count: row.assignment_attachments.length,
        total_count: total,
      };
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    activeClassCount: classIds.length,
  };
}

export type DashboardPendingInvitation = {
  id: string;
  class_id: string;
  class_name: string;
  class_slug: string;
  admin_name: string;
  expires_at: string;
};

export async function listStudentPendingInvitations(
  userId: string,
  userEmail: string | undefined,
): Promise<DashboardPendingInvitation[]> {
  if (!userEmail) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const { data: invitations, error } = await supabase
    .from("class_invitations")
    .select(
      `
      id,
      class_id,
      expires_at,
      max_uses,
      used_count,
      revoked_at,
      created_by,
      classes!class_invitations_class_id_fkey ( id, name, slug, status )
    `,
    )
    .ilike("email_restriction", userEmail.trim())
    .is("revoked_at", null)
    .gt("expires_at", now);

  if (error || !invitations) {
    return [];
  }

  const validInvitations = invitations.filter(
    (inv) =>
      inv.used_count < inv.max_uses &&
      inv.classes &&
      inv.classes.status === "active",
  );

  if (validInvitations.length === 0) {
    return [];
  }

  const classIds = validInvitations.map((inv) => inv.class_id);
  const invitationIds = validInvitations.map((inv) => inv.id);

  const [memberships, acceptances, declines, profiles] = await Promise.all([
    supabase
      .from("class_members")
      .select("class_id")
      .eq("user_id", userId)
      .in("class_id", classIds),
    supabase
      .from("class_invitation_acceptances")
      .select("invitation_id")
      .eq("user_id", userId)
      .in("invitation_id", invitationIds),
    supabase
      .from("class_invitation_declines")
      .select("invitation_id")
      .eq("user_id", userId)
      .in("invitation_id", invitationIds),
    loadProfiles(validInvitations.map((inv) => inv.created_by)),
  ]);

  const memberClassIds = new Set(
    (memberships.data ?? []).map((m) => m.class_id),
  );
  const acceptedInvIds = new Set(
    (acceptances.data ?? []).map((a) => a.invitation_id),
  );
  const declinedInvIds = new Set(
    (declines.data ?? []).map((d) => d.invitation_id),
  );

  return validInvitations
    .filter(
      (inv) =>
        !memberClassIds.has(inv.class_id) &&
        !acceptedInvIds.has(inv.id) &&
        !declinedInvIds.has(inv.id),
    )
    .map((inv) => ({
      id: inv.id,
      class_id: inv.class_id,
      class_name: inv.classes?.name ?? "Class",
      class_slug: inv.classes?.slug ?? "",
      admin_name: profiles.get(inv.created_by)?.display_name ?? "Class Admin",
      expires_at: inv.expires_at,
    }));
}

export type MyWeekItemKind = "assignment" | "session" | "leave";

/**
 * One line in the "My week" timeline.
 *
 * The three sources share a table because the student's question is "what is
 * happening next", not "which table is it from". `key` is prefixed with the
 * kind because ids from different tables can collide.
 */
export type MyWeekItem = {
  key: string;
  kind: MyWeekItemKind;
  title: string;
  className: string;
  /** Sortable instant. An all-day leave request is anchored to its first day. */
  at: string;
  /** Sessions carry an end so the timeline can show a real time range. */
  endsAt: string | null;
  allDay: boolean;
  href: string;
  detail: string;
};

export type MyWeek = {
  items: MyWeekItem[];
  startsAtIso: string;
  endsAtIso: string;
  /** Monday 00:00 WIB of the displayed week, as an ISO instant. */
  weekStartIso: string;
};

const DAY_MS = 86_400_000;
const MY_WEEK_ITEM_LIMIT = 40;

/**
 * Monday 00:00 Asia/Jakarta for the week containing `now`, shifted by
 * `weekOffset` weeks. Jakarta has no DST, so a fixed offset is exact.
 */
function jakartaWeekStart(now: Date, weekOffset: number): Date {
  const dateKey = toJakartaDateKey(now);
  const midnight = Date.parse(`${dateKey}T00:00:00${APP_TIME_ZONE_OFFSET}`);
  // Reading the date key back in UTC gives the weekday of that calendar date
  // without letting the host machine's zone leak into the calculation.
  const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;

  return new Date(
    midnight - daysSinceMonday * DAY_MS + weekOffset * 7 * DAY_MS,
  );
}

/**
 * Deadline, session, and leave items for one Jakarta week.
 *
 * Deadlines and sessions come from the caller's active classes; leave requests
 * are always the caller's own. RLS still filters every row, so the explicit
 * class and student filters only make the intent visible in code.
 */
export async function getMyWeek(
  userId: string,
  now: Date = new Date(),
  weekOffset = 0,
): Promise<MyWeek> {
  const weekStart = jakartaWeekStart(now, weekOffset);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  const startsAtIso = weekStart.toISOString();
  const endsAtIso = weekEnd.toISOString();
  const weekStartKey = toJakartaDateKey(weekStart);
  // The window end is exclusive midnight, so subtract a millisecond before
  // turning it into an inclusive date key for the leave overlap filter.
  const lastDayKey = toJakartaDateKey(new Date(weekEnd.getTime() - 1));

  const memberships = await listMyClasses(userId);
  const classIds = memberships
    .filter((classItem) => classItem.status === "active")
    .map((classItem) => classItem.id);
  const classNames = new Map(
    memberships.map((classItem) => [classItem.id, classItem.name]),
  );

  if (classIds.length === 0) {
    return { items: [], startsAtIso, endsAtIso, weekStartIso: startsAtIso };
  }

  const supabase = await createSupabaseServerClient();

  // Deadline rows include the class's public course tasks (no class/subject
  // yet, matched by `course_id`), mirroring the dashboard stats and the class
  // pages. Without this they would be invisible here while visible elsewhere.
  const { data: subjectCourseRows } = await supabase
    .from("class_subjects")
    .select("course_id")
    .in("class_id", classIds);

  const myWeekCourseIds = [
    ...new Set(
      (subjectCourseRows ?? [])
        .map((row) => row.course_id)
        .filter((courseId): courseId is string => Boolean(courseId)),
    ),
  ];

  const [
    assignmentsResult,
    publicAssignmentsResult,
    sessionsResult,
    leaveResult,
  ] = await Promise.all([
    supabase
      .from("assignments")
      .select(
        "id, title, deadline, class_id, classes!assignments_class_id_fkey ( name )",
      )
      .in("class_id", classIds)
      .eq("status", "published")
      .gte("deadline", startsAtIso)
      .lt("deadline", endsAtIso)
      .order("deadline", { ascending: true })
      .limit(MY_WEEK_ITEM_LIMIT),
    myWeekCourseIds.length > 0
      ? supabase
          .from("assignments")
          .select(
            "id, title, deadline, courses!assignments_course_id_fkey ( name )",
          )
          .is("class_id", null)
          .is("subject_id", null)
          .eq("status", "published")
          .in("course_id", myWeekCourseIds)
          .gte("deadline", startsAtIso)
          .lt("deadline", endsAtIso)
          .order("deadline", { ascending: true })
          .limit(MY_WEEK_ITEM_LIMIT)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("discussion_sessions")
      .select(
        "id, title, starts_at, ends_at, session_type, location, meeting_url, class_id, classes!discussion_sessions_class_id_fkey ( name )",
      )
      .in("class_id", classIds)
      .eq("status", "scheduled")
      .gte("starts_at", startsAtIso)
      .lt("starts_at", endsAtIso)
      .order("starts_at", { ascending: true })
      .limit(MY_WEEK_ITEM_LIMIT),
    supabase
      .from("leave_requests")
      .select(
        "id, leave_start_date, leave_end_date, reason_category, status, class_id",
      )
      .eq("student_id", userId)
      .neq("status", "draft")
      .neq("status", "cancelled")
      .neq("status", "rejected")
      .gte("leave_end_date", weekStartKey)
      .lte("leave_start_date", lastDayKey)
      .order("leave_start_date", { ascending: true })
      .limit(MY_WEEK_ITEM_LIMIT),
  ]);

  const failures = [
    {
      result: assignmentsResult,
      message: "Could not load this week's deadlines",
    },
    {
      result: publicAssignmentsResult,
      message: "Could not load this week's deadlines",
    },
    { result: sessionsResult, message: "Could not load this week's sessions" },
    { result: leaveResult, message: "Could not load this week's absences" },
  ];

  for (const failure of failures) {
    if (failure.result.error) {
      throw new DataAccessError(failure.message, failure.result.error.code);
    }
  }

  const assignmentItems: MyWeekItem[] = [
    ...(assignmentsResult.data ?? []),
    ...(publicAssignmentsResult.data ?? []),
  ].flatMap((row) => {
    if (!row.deadline) {
      return [];
    }

    const className =
      "classes" in row && row.classes
        ? row.classes.name
        : "courses" in row && row.courses
          ? row.courses.name
          : "Class";

    return [
      {
        key: `assignment:${row.id}`,
        kind: "assignment" as const,
        title: row.title,
        className,
        at: row.deadline,
        endsAt: null,
        allDay: false,
        href: `/assignments/${row.id}`,
        detail: "Deadline",
      },
    ];
  });

  const sessionItems: MyWeekItem[] = (sessionsResult.data ?? []).flatMap(
    (row) => [
      {
        key: `session:${row.id}`,
        kind: "session" as const,
        title: row.title,
        className: row.classes?.name ?? "Class",
        at: row.starts_at,
        endsAt: row.ends_at,
        allDay: false,
        href: `/sessions/${row.id}`,
        detail:
          row.session_type === "online"
            ? "Online session"
            : "In-person session",
      },
    ],
  );

  const leaveItems: MyWeekItem[] = (leaveResult.data ?? []).flatMap((row) => {
    if (!row.leave_start_date) {
      return [];
    }

    // An ongoing leave keeps its original start date as the anchor, so the
    // timeline does not jump when the student refreshes on a later day. A leave
    // that started before the displayed week is pinned to that week's Monday.
    const anchorKey =
      row.leave_start_date < weekStartKey ? weekStartKey : row.leave_start_date;
    const reason = row.reason_category
      ? LEAVE_REASON_LABELS[row.reason_category as LeaveReasonCategory]
      : "Absence";
    const statusLabel =
      LEAVE_STATUS_LABELS[row.status as LeaveRequestStatus] ?? "Submitted";

    return [
      {
        key: `leave:${row.id}`,
        kind: "leave" as const,
        title: reason,
        className: classNames.get(row.class_id) ?? "Class",
        at: new Date(
          `${anchorKey}T00:00:00${APP_TIME_ZONE_OFFSET}`,
        ).toISOString(),
        endsAt: null,
        allDay: true,
        href: `/leave-requests/${row.id}`,
        detail: `Absence - ${statusLabel}`,
      },
    ];
  });

  const items = [...assignmentItems, ...sessionItems, ...leaveItems]
    .sort((left, right) => left.at.localeCompare(right.at))
    .slice(0, MY_WEEK_ITEM_LIMIT);

  return { items, startsAtIso, endsAtIso, weekStartIso: startsAtIso };
}

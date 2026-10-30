import "server-only";

import type { MemberAssignmentsQuery } from "@starstask/contracts";
import {
  LEAVE_REASON_LABELS,
  LEAVE_STATUS_LABELS,
  notificationEventPayloadSchema,
  type LeaveReasonCategory,
  type LeaveRequestStatus,
} from "@starstask/contracts";
import {
  APP_TIME_ZONE_OFFSET,
  getDueSoonWindow,
  isKnownTimeZone,
  toJakartaDateKey,
} from "@starstask/shared";

import { DataAccessError, type PaginatedResult } from "@/lib/db/assignments";
import { listMyClasses, loadProfiles } from "@/lib/db/classes";
import { isSafeNotificationPath } from "@/lib/push/payload";
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
 * Tasks are published assignments in the caller's active classes. There is no
 * per-student completion state in the schema, so a deadline that has passed is
 * reported as a "past deadline" rather than claiming the work is outstanding.
 */
export async function getDashboardOverview(
  userId: string,
): Promise<DashboardOverview> {
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
      stats: { totalTasks: 0, dueSoon: 0, pastDeadline: 0, classCount: 0 },
      recentTasks: [],
      timeZone,
      nowIso,
    };
  }

  const countPublishedTasks = () =>
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .in("class_id", classIds)
      .eq("status", "published");

  const [dueSoonResult, pastDeadlineResult, recentTasksResult] =
    await Promise.all([
      // The half-open WIB window is shared with the deadline badges: today
      // through the next seven calendar days.
      countPublishedTasks()
        .gte("deadline", dueSoonStartIso)
        .lt("deadline", dueSoonEndIso),
      countPublishedTasks().lt("deadline", dueSoonStartIso),
      supabase
        .from("assignments")
        .select(
          "id, title, deadline, classes!assignments_class_id_fkey ( name )",
        )
        .in("class_id", classIds)
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(RECENT_TASK_LIMIT),
    ]);

  const failures = [
    { result: dueSoonResult, message: "Could not count due tasks" },
    { result: pastDeadlineResult, message: "Could not count past deadlines" },
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
    activeClasses.map((classItem) =>
      countPublishedTasks().eq("class_id", classItem.id),
    ),
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
      subject_count: classItem.subject_count ?? 1,
      admin_name: classItem.admin_name ?? null,
    };
  });

  const totalTasks = classes.reduce(
    (total, classItem) => total + classItem.task_count,
    0,
  );

  const recentTasks: DashboardTask[] = (recentTasksResult.data ?? []).flatMap(
    (row) => {
      if (!row.classes) {
        return [];
      }

      return [
        {
          id: row.id,
          title: row.title,
          deadline: row.deadline,
          class_name: row.classes.name,
        },
      ];
    },
  );

  return {
    classes,
    stats: {
      totalTasks,
      dueSoon: dueSoonResult.count ?? 0,
      pastDeadline: pastDeadlineResult.count ?? 0,
      classCount: activeClasses.length,
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

const DASHBOARD_NOTIFICATION_LIMIT = 5;

export type DashboardNotification = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
};

/**
 * The caller's latest in-app notifications.
 *
 * No `user_id` filter is added here because that column is deliberately not
 * granted to `authenticated`; the `notification_events_read` policy scopes the
 * rows to `auth.uid()`. Payloads are sanitized by the database functions that
 * enqueue them, and a URL is only surfaced when it is an internal app path.
 */
export async function listMyNotifications(
  limit: number = DASHBOARD_NOTIFICATION_LIMIT,
): Promise<DashboardNotification[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notification_events")
    .select("id, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataAccessError("Could not load your notifications", error.code);
  }

  return (data ?? []).flatMap((row) => {
    const parsed = notificationEventPayloadSchema.safeParse(row.payload);

    if (!parsed.success) {
      return [];
    }

    return [
      {
        id: row.id,
        title: parsed.data.title,
        body: parsed.data.body,
        href: isSafeNotificationPath(parsed.data.url) ? parsed.data.url : null,
        createdAt: row.created_at,
      },
    ];
  });
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
      "id, title, description, course_id, class_id, user_id, lecturer_name, semester, academic_year, assignment_type, deadline, tags, created_at, updated_at, courses!assignments_course_id_fkey ( name, code ), assignment_attachments ( id )",
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
  allDay: boolean;
  href: string;
  detail: string;
};

export type MyWeek = {
  items: MyWeekItem[];
  startsAtIso: string;
  endsAtIso: string;
};

const MY_WEEK_ITEM_LIMIT = 40;

/**
 * Deadline, session, and leave items for the next Jakarta week.
 *
 * Deadlines and sessions come from the caller's active classes; leave requests
 * are always the caller's own. RLS still filters every row, so the explicit
 * class and student filters only make the intent visible in code.
 */
export async function getMyWeek(
  userId: string,
  now: Date = new Date(),
): Promise<MyWeek> {
  const window = getDueSoonWindow(now);
  const startsAtIso = now.toISOString();
  const endsAtIso = window.end.toISOString();
  const todayKey = toJakartaDateKey(now);
  // The window end is exclusive midnight, so subtract a millisecond before
  // turning it into an inclusive date key for the leave overlap filter.
  const lastDayKey = toJakartaDateKey(new Date(window.end.getTime() - 1));

  const memberships = await listMyClasses(userId);
  const classIds = memberships
    .filter((classItem) => classItem.status === "active")
    .map((classItem) => classItem.id);
  const classNames = new Map(
    memberships.map((classItem) => [classItem.id, classItem.name]),
  );

  if (classIds.length === 0) {
    return { items: [], startsAtIso, endsAtIso };
  }

  const supabase = await createSupabaseServerClient();

  const [assignmentsResult, sessionsResult, leaveResult] = await Promise.all([
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
    supabase
      .from("discussion_sessions")
      .select(
        "id, title, starts_at, session_type, location, meeting_url, class_id, classes!discussion_sessions_class_id_fkey ( name )",
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
      .gte("leave_end_date", todayKey)
      .lte("leave_start_date", lastDayKey)
      .order("leave_start_date", { ascending: true })
      .limit(MY_WEEK_ITEM_LIMIT),
  ]);

  const failures = [
    {
      result: assignmentsResult,
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

  const assignmentItems: MyWeekItem[] = (assignmentsResult.data ?? []).flatMap(
    (row) => {
      if (!row.deadline) {
        return [];
      }

      return [
        {
          key: `assignment:${row.id}`,
          kind: "assignment" as const,
          title: row.title,
          className: row.classes?.name ?? "Class",
          at: row.deadline,
          allDay: false,
          href: `/assignments/${row.id}`,
          detail: "Deadline",
        },
      ];
    },
  );

  const sessionItems: MyWeekItem[] = (sessionsResult.data ?? []).flatMap(
    (row) => [
      {
        key: `session:${row.id}`,
        kind: "session" as const,
        title: row.title,
        className: row.classes?.name ?? "Class",
        at: row.starts_at,
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
    // timeline does not jump when the student refreshes on a later day.
    const anchorKey =
      row.leave_start_date < todayKey ? todayKey : row.leave_start_date;
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
        allDay: true,
        href: `/leave-requests/${row.id}`,
        detail: `Absence - ${statusLabel}`,
      },
    ];
  });

  const items = [...assignmentItems, ...sessionItems, ...leaveItems]
    .sort((left, right) => left.at.localeCompare(right.at))
    .slice(0, MY_WEEK_ITEM_LIMIT);

  return { items, startsAtIso, endsAtIso };
}

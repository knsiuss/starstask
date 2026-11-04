import "server-only";

import type { AssignmentWorkspaceQuery } from "@starstask/contracts";

import {
  deadlineUrgency,
  sortScheduleItems,
  toRequestStatus,
  type RequestStatus,
} from "@/lib/assignments/workspace";
import { DataAccessError, type PaginatedResult } from "@/lib/db/assignments";
import { listMyClasses, loadProfiles } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WorkspaceClassOption = {
  id: string;
  slug: string;
  name: string;
  class_code: string | null;
  is_admin: boolean;
  subjects: { id: string; name: string; code: string | null }[];
};

export type WorkspaceScope = {
  classes: WorkspaceClassOption[];
  classIds: string[];
  managedClassIds: string[];
  managesAnyClass: boolean;
};

export type WorkspaceScheduleItem = {
  id: string;
  title: string;
  description: string;
  status: string;
  deadline: string | null;
  created_at: string;
  course_name: string;
  course_code: string | null;
  class_name: string | null;
  class_code: string | null;
  class_slug: string | null;
  attachment_count: number;
};

export type WorkspaceOverview = {
  total: number;
  upcoming: number;
  expired: number;
  upcomingDeadlines: {
    id: string;
    title: string;
    label: string;
    deadline: string;
  }[];
};

export type WorkspaceRequest = {
  id: string;
  title: string;
  description: string;
  status: string;
  displayStatus: RequestStatus;
  deadline: string | null;
  rejection_reason: string | null;
  created_at: string;
  class_id: string;
  class_name: string;
  class_slug: string;
  class_code: string | null;
  course_name: string;
  subject_id: string | null;
  submitter_name: string | null;
};

const SCHEDULE_COLUMNS =
  "id, title, description, status, deadline, created_at, course_id, class_id, subject_id, user_id, tags, courses!assignments_course_id_fkey ( name, code ), classes!assignments_class_id_fkey ( name, class_code, slug ), assignment_attachments ( id )";

// Bounds the in-memory merge below; class workspaces stay far under this.
const SCHEDULE_FETCH_LIMIT = 500;
const REQUEST_LIMIT = 50;
const CLASS_OPTION_LIMIT = 20;

/** Active memberships plus the per-class subject picker for the request dialog. */
export async function getWorkspaceScope(
  userId: string,
): Promise<WorkspaceScope> {
  const memberships = await listMyClasses(userId);
  const active = memberships.filter((item) => item.status === "active");
  const classIds = active.map((item) => item.id);
  const managedClassIds = active
    .filter((item) => item.is_admin)
    .map((item) => item.id);

  const supabase = await createSupabaseServerClient();
  const classes: WorkspaceClassOption[] = [];

  for (const item of active.slice(0, CLASS_OPTION_LIMIT)) {
    const { data: subjects, error } = await supabase
      .from("class_subjects")
      .select("id, name, code")
      .eq("class_id", item.id)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) {
      throw new DataAccessError("Could not load your classes", error.code);
    }

    classes.push({
      id: item.id,
      slug: item.slug,
      name: item.name,
      class_code: item.class_code,
      is_admin: item.is_admin,
      subjects: (subjects ?? []).map((subject) => ({
        id: subject.id,
        name: subject.name,
        code: subject.code,
      })),
    });
  }

  return {
    classes,
    classIds,
    managedClassIds,
    managesAnyClass: managedClassIds.length > 0,
  };
}

async function loadCatalogCourseIds(classIds: string[]): Promise<string[]> {
  if (classIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_subjects")
    .select("course_id")
    .in("class_id", classIds);

  if (error) {
    throw new DataAccessError("Could not load your courses", error.code);
  }

  return [
    ...new Set(
      (data ?? [])
        .map((row) => row.course_id)
        .filter((courseId): courseId is string => Boolean(courseId)),
    ),
  ];
}

function toScheduleItem(
  row: {
    id: string;
    title: string;
    description: string;
    status: string;
    deadline: string | null;
    created_at: string;
    courses: { name: string; code: string | null } | null;
    classes: { name: string; class_code: string | null; slug: string } | null;
    assignment_attachments: { id: string }[];
  },
  fallbackCourseName: string | null,
): WorkspaceScheduleItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    deadline: row.deadline,
    created_at: row.created_at,
    course_name: row.courses?.name ?? fallbackCourseName ?? "Unknown course",
    course_code: row.courses?.code ?? null,
    class_name: row.classes?.name ?? null,
    class_code: row.classes?.class_code ?? null,
    class_slug: row.classes?.slug ?? null,
    attachment_count: row.assignment_attachments.length,
  };
}

/**
 * Task Schedule list: published work across member classes plus the class's
 * public course tasks. Class admins additionally see every status inside the
 * classes they manage, because the reviewer read policy already grants it.
 */
export async function listWorkspaceSchedule(
  scope: WorkspaceScope,
  query: AssignmentWorkspaceQuery,
): Promise<PaginatedResult<WorkspaceScheduleItem>> {
  const { classIds, managedClassIds } = scope;

  if (classIds.length === 0) {
    return {
      items: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: 1,
    };
  }

  const supabase = await createSupabaseServerClient();
  const courseIds = await loadCatalogCourseIds(classIds);

  const classFilter =
    query.class && classIds.includes(query.class) ? query.class : null;

  const search = query.search;

  const scopedQuery = () => {
    let request = supabase
      .from("assignments")
      .select(SCHEDULE_COLUMNS)
      .in("class_id", classIds)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(SCHEDULE_FETCH_LIMIT);

    if (classFilter) {
      request = request.eq("class_id", classFilter);
    }

    if (search) {
      request = request.ilike("title", `%${escapeLike(search)}%`);
    }

    return request;
  };

  const publicQuery = () => {
    let request = supabase
      .from("assignments")
      .select(SCHEDULE_COLUMNS)
      .is("class_id", null)
      .is("subject_id", null)
      .in("course_id", courseIds)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(SCHEDULE_FETCH_LIMIT);

    if (classFilter) {
      request = request.eq("class_id", classFilter);
    }

    if (search) {
      request = request.ilike("title", `%${escapeLike(search)}%`);
    }

    return request;
  };

  const managedQuery = () => {
    let request = supabase
      .from("assignments")
      .select(SCHEDULE_COLUMNS)
      .in("class_id", managedClassIds)
      .neq("status", "published")
      .order("created_at", { ascending: false })
      .limit(SCHEDULE_FETCH_LIMIT);

    if (classFilter) {
      request = request.eq("class_id", classFilter);
    }

    if (search) {
      request = request.ilike("title", `%${escapeLike(search)}%`);
    }

    return request;
  };

  const [publishedScoped, publishedPublic, managedReview] = await Promise.all([
    scopedQuery(),
    courseIds.length > 0
      ? publicQuery()
      : Promise.resolve({ data: [], error: null }),
    managedClassIds.length > 0
      ? managedQuery()
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [publishedScoped, publishedPublic, managedReview]) {
    if (result.error) {
      throw new DataAccessError(
        "Could not load assignments",
        result.error.code,
      );
    }
  }

  const classCourseNames = new Map<string, string>();

  for (const item of scope.classes) {
    classCourseNames.set(item.id, item.name);
  }

  type ScheduleRow = Parameters<typeof toScheduleItem>[0] & {
    class_id: string | null;
  };

  const scheduleRows = [
    ...((publishedScoped.data ?? []) as ScheduleRow[]),
    ...((publishedPublic.data ?? []) as ScheduleRow[]),
    ...((managedReview.data ?? []) as ScheduleRow[]),
  ];

  const seen = new Set<string>();
  const merged = scheduleRows.flatMap((row) => {
    if (seen.has(row.id)) {
      return [];
    }

    seen.add(row.id);

    return [
      toScheduleItem(
        row,
        row.class_id ? (classCourseNames.get(row.class_id) ?? null) : null,
      ),
    ];
  });

  const now = new Date();
  const filtered =
    query.status === "all"
      ? merged
      : merged.filter((item) => {
          if (query.status === "upcoming") {
            return deadlineUrgency(item.deadline, now) === "upcoming";
          }

          if (query.status === "overdue") {
            return deadlineUrgency(item.deadline, now) === "expired";
          }

          if (query.status === "no_deadline") {
            return item.deadline === null;
          }

          return item.status === query.status;
        });

  const sorted = sortScheduleItems(filtered, query.sort);
  const total = sorted.length;
  const offset = (query.page - 1) * query.pageSize;

  return {
    items: sorted.slice(offset, offset + query.pageSize),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/**
 * Sidebar numbers from the same visible published set the schedule renders, so
 * the counts can never disagree with the list.
 */
export async function getWorkspaceOverview(
  scope: WorkspaceScope,
): Promise<WorkspaceOverview> {
  const { classIds } = scope;

  if (classIds.length === 0) {
    return { total: 0, upcoming: 0, expired: 0, upcomingDeadlines: [] };
  }

  const supabase = await createSupabaseServerClient();
  const courseIds = await loadCatalogCourseIds(classIds);
  const now = new Date();
  const nowIso = now.toISOString();

  const [scoped, publicRows] = await Promise.all([
    supabase
      .from("assignments")
      .select(
        "id, title, deadline, course_id, class_id, courses!assignments_course_id_fkey ( name ), classes!assignments_class_id_fkey ( name )",
      )
      .in("class_id", classIds)
      .eq("status", "published")
      .not("deadline", "is", null),
    courseIds.length > 0
      ? supabase
          .from("assignments")
          .select(
            "id, title, deadline, course_id, class_id, courses!assignments_course_id_fkey ( name ), classes!assignments_class_id_fkey ( name )",
          )
          .is("class_id", null)
          .is("subject_id", null)
          .in("course_id", courseIds)
          .eq("status", "published")
          .not("deadline", "is", null)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [scoped, publicRows]) {
    if (result.error) {
      throw new DataAccessError("Could not load statistics", result.error.code);
    }
  }

  const rows = [...(scoped.data ?? []), ...(publicRows.data ?? [])];
  const unique = rows.filter(
    (item, index, list) => list.findIndex((o) => o.id === item.id) === index,
  );

  const classCourseNames = new Map(
    scope.classes.map((item) => [item.id, item.name]),
  );
  let upcoming = 0;
  let expired = 0;

  const upcomingDeadlines = unique.flatMap((row) => {
    if (!row.deadline) {
      return [];
    }

    if (row.deadline >= nowIso) {
      upcoming += 1;
    } else {
      expired += 1;
    }

    const label =
      row.courses?.name ??
      (row.class_id ? classCourseNames.get(row.class_id) : null) ??
      "Unknown course";

    return [
      {
        id: row.id,
        title: row.title,
        label,
        deadline: row.deadline,
      },
    ];
  });

  upcomingDeadlines.sort((a, b) => a.deadline.localeCompare(b.deadline));

  return {
    total: unique.length,
    upcoming,
    expired,
    upcomingDeadlines: upcomingDeadlines
      .filter((item) => item.deadline >= nowIso)
      .slice(0, 5),
  };
}

/** The caller's own class submissions across every class they belong to. */
export async function listMyRequests(
  userId: string,
  scope: WorkspaceScope,
): Promise<WorkspaceRequest[]> {
  if (scope.classIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      "id, title, description, status, deadline, rejection_reason, created_at, class_id, subject_id, courses!assignments_course_id_fkey ( name ), classes!assignments_class_id_fkey ( name, slug, class_code )",
    )
    .eq("user_id", userId)
    .in("class_id", scope.classIds)
    .in("status", ["pending_review", "rejected", "published"])
    .order("created_at", { ascending: false })
    .limit(REQUEST_LIMIT);

  if (error) {
    throw new DataAccessError("Could not load your requests", error.code);
  }

  return toRequests(data ?? []);
}

/**
 * Totales for the requests tab: the admin queue is the pending-review rows in
 * managed classes; the student tab counts their own requests.
 */
export async function listManagedRequests(
  scope: WorkspaceScope,
): Promise<WorkspaceRequest[]> {
  if (scope.managedClassIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      "id, title, description, status, deadline, rejection_reason, created_at, class_id, subject_id, user_id, courses!assignments_course_id_fkey ( name ), classes!assignments_class_id_fkey ( name, slug, class_code )",
    )
    .in("class_id", scope.managedClassIds)
    .in("status", ["pending_review", "rejected", "published"])
    .order("created_at", { ascending: false })
    .limit(REQUEST_LIMIT);

  if (error) {
    throw new DataAccessError("Could not load requests", error.code);
  }

  const rows = data ?? [];
  const profiles = await loadProfiles(rows.map((row) => row.user_id));

  return toRequests(rows, (ownerId) =>
    ownerId && profiles.get(ownerId)
      ? (profiles.get(ownerId)?.display_name ?? null)
      : null,
  );
}

function toRequests(
  rows: {
    id: string;
    title: string;
    description: string;
    status: string;
    deadline: string | null;
    rejection_reason: string | null;
    created_at: string;
    class_id: string | null;
    subject_id: string | null;
    user_id?: string;
    courses: { name: string } | null;
    classes: { name: string; slug: string; class_code: string | null } | null;
  }[],
  submitterName?: (userId: string | undefined) => string | null,
): WorkspaceRequest[] {
  return rows.flatMap((row) => {
    if (!row.class_id || !row.classes) {
      return [];
    }

    return [
      {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        displayStatus: toRequestStatus({
          status: row.status,
          rejection_reason: row.rejection_reason,
        }),
        deadline: row.deadline,
        rejection_reason: row.rejection_reason,
        created_at: row.created_at,
        class_id: row.class_id,
        class_name: row.classes.name,
        class_slug: row.classes.slug,
        class_code: row.classes.class_code,
        course_name: row.courses?.name ?? "Unknown course",
        subject_id: row.subject_id,
        submitter_name: submitterName ? submitterName(row.user_id) : null,
      },
    ];
  });
}

function escapeLike(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

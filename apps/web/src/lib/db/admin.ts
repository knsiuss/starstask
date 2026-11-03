import "server-only";

import type {
  AdminAssignmentQuery,
  AdminAssignmentStatus,
  AdminClassesQuery,
  AdminUsersQuery,
  ClassLifecycleStatus,
} from "@starstask/contracts";

import { DataAccessError, type PaginatedResult } from "@/lib/db/assignments";
import { loadProfiles } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Read models for the platform admin console.
 *
 * The directory queries run through SECURITY DEFINER functions that re-check
 * `is_platform_admin()` and return only fields the console needs. The
 * assignment list reads the tables directly: the reviewer RLS policy already
 * limits a platform admin to class-scoped rows, and the page still filters to
 * `class_id is not null` because moderation only applies to class submissions.
 */

export type PlatformUserListItem = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string;
  onboardedAt: string | null;
  isPlatformAdmin: boolean;
  classCount: number;
  adminClassCount: number;
};

export async function listPlatformUsers(
  query: AdminUsersQuery,
): Promise<PaginatedResult<PlatformUserListItem>> {
  const supabase = await createSupabaseServerClient();
  const offset = (query.page - 1) * query.pageSize;

  const { data, error } = await supabase.rpc("list_platform_users", {
    p_search: query.search ?? null,
    p_role: query.role,
    p_onboarding: query.onboarding,
    p_limit: query.pageSize,
    p_offset: offset,
  });

  if (error) {
    throw new DataAccessError("Could not load users", error.code);
  }

  const rows = data ?? [];
  const total = Number(rows[0]?.total_count ?? 0);

  return {
    items: rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      joinedAt: row.created_at,
      onboardedAt: row.onboarded_at,
      isPlatformAdmin: row.is_platform_admin,
      classCount: Number(row.class_count),
      adminClassCount: Number(row.admin_class_count),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export type AdminClassListItem = {
  id: string;
  slug: string;
  name: string;
  classCode: string | null;
  description: string;
  courseName: string;
  institution: string | null;
  lecturerName: string | null;
  semester: string;
  academicYear: string;
  status: ClassLifecycleStatus;
  archivedAt: string | null;
  createdAt: string;
  memberCount: number;
  adminCount: number;
  subjectCount: number;
  adminNames: string[];
};

export async function listPlatformClasses(
  query: AdminClassesQuery,
): Promise<PaginatedResult<AdminClassListItem>> {
  const supabase = await createSupabaseServerClient();
  const offset = (query.page - 1) * query.pageSize;

  const { data, error } = await supabase.rpc("list_platform_classes", {
    p_search: query.search ?? null,
    p_status: query.status,
    p_academic_year: query.academicYear ?? null,
    p_semester: query.semester ?? null,
    p_limit: query.pageSize,
    p_offset: offset,
  });

  if (error) {
    throw new DataAccessError("Could not load classes", error.code);
  }

  const rows = data ?? [];
  const total = Number(rows[0]?.total_count ?? 0);

  return {
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      classCode: row.class_code,
      description: row.description,
      courseName: row.course_name,
      institution: row.institution,
      lecturerName: row.lecturer_name,
      semester: row.semester,
      academicYear: row.academic_year,
      status: row.status,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      memberCount: Number(row.member_count),
      adminCount: Number(row.admin_count),
      subjectCount: Number(row.subject_count),
      adminNames: row.admin_names ?? [],
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export type AdminPublicAssignmentListItem = {
  id: string;
  title: string;
  status: AdminAssignmentStatus;
  rejectionReason: string | null;
  submitter: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
  deadline: string | null;
};

const ADMIN_PUBLIC_ASSIGNMENT_COLUMNS =
  "id, title, status, rejection_reason, created_at, updated_at, deadline, user_id";

/**
 * Class-less assignment requests waiting for a platform admin.
 *
 * Reads the table directly: `assignments_platform_review_read` (added with the
 * public review flow) lets a platform admin see pending and rejected rows that
 * other visitors cannot.
 */
export async function listAdminPublicAssignments(
  limit = 20,
): Promise<AdminPublicAssignmentListItem[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assignments")
    .select(ADMIN_PUBLIC_ASSIGNMENT_COLUMNS)
    .is("class_id", null)
    .in("status", ["pending", "rejected"])
    .order("status", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new DataAccessError("Could not load assignment requests", error.code);
  }

  const rows = data ?? [];
  const profiles = await loadProfiles(rows.map((row) => row.user_id));

  return rows.map((row) => {
    const profile = profiles.get(row.user_id);

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      rejectionReason: row.rejection_reason,
      submitter: {
        id: row.user_id,
        displayName: profile?.display_name ?? "StarsTask member",
        avatarUrl: profile?.avatar_url ?? null,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deadline: row.deadline,
    };
  });
}

export type AdminClassOption = {
  id: string;
  name: string;
};

/** Filter options only; no descriptions or membership data. */
export async function listAdminClassOptions(): Promise<AdminClassOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(300);

  if (error) {
    throw new DataAccessError("Could not load class options", error.code);
  }

  return data ?? [];
}

export type AdminAssignmentListItem = {
  id: string;
  title: string;
  status: AdminAssignmentStatus;
  classSlug: string;
  className: string;
  submitter: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
  deadline: string | null;
};

const ADMIN_ASSIGNMENT_COLUMNS =
  "id, title, status, created_at, updated_at, deadline, user_id, class_id, classes!assignments_class_id_fkey ( slug, name )";

export async function listAdminAssignments(
  query: AdminAssignmentQuery,
): Promise<PaginatedResult<AdminAssignmentListItem>> {
  const supabase = await createSupabaseServerClient();
  const offset = (query.page - 1) * query.pageSize;

  let request = supabase
    .from("assignments")
    .select(ADMIN_ASSIGNMENT_COLUMNS, { count: "exact" })
    .not("class_id", "is", null);

  if (query.status !== "all") {
    request = request.eq("status", query.status);
  }

  if (query.class) {
    request = request.eq("class_id", query.class);
  }

  if (query.search) {
    request = request.ilike("title", `%${query.search}%`);
  }

  const { data, error, count } = await request
    .order("updated_at", { ascending: false })
    .range(offset, offset + query.pageSize - 1);

  if (error) {
    throw new DataAccessError("Could not load assignments", error.code);
  }

  const rows = data ?? [];
  const profiles = await loadProfiles(rows.map((row) => row.user_id));

  const items = rows.flatMap((row) => {
    if (!row.classes) {
      return [];
    }

    const profile = profiles.get(row.user_id);

    return [
      {
        id: row.id,
        title: row.title,
        status: row.status,
        classSlug: row.classes.slug,
        className: row.classes.name,
        submitter: {
          id: row.user_id,
          displayName: profile?.display_name ?? "StarsTask member",
          avatarUrl: profile?.avatar_url ?? null,
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deadline: row.deadline,
      },
    ];
  });

  const total = count ?? 0;

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

import "server-only";

import type {
  ClassApplicationStatus,
  ClassDiscoveryQuery,
  ClassStatus,
} from "@starstask/contracts";

import { DataAccessError, type PaginatedResult } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClassListItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  course_name: string;
  institution: string | null;
  lecturer_name: string | null;
  semester: string;
  academic_year: string;
  created_at: string;
  member_count: number;
};

export type ClassSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  course_name: string;
  institution: string | null;
  lecturer_name: string | null;
  semester: string;
  academic_year: string;
  status: ClassStatus;
  created_at: string;
  updated_at: string;
};

export type MyClassSummary = {
  id: string;
  slug: string;
  name: string;
  course_name: string;
  semester: string;
  academic_year: string;
  status: ClassStatus;
  joined_at: string;
  is_admin: boolean;
};

export type ClassRole = {
  isPlatformAdmin: boolean;
  isMember: boolean;
  isAdmin: boolean;
  canManage: boolean;
};

export type ClassMemberView = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  joined_via: "invitation" | "admin_assignment" | "platform_assignment";
  joined_at: string;
  is_admin: boolean;
};

export type ClassInvitationView = {
  id: string;
  email_restriction: string | null;
  expires_at: string;
  max_uses: number;
  used_count: number;
  revoked_at: string | null;
  created_at: string;
};

export type ClassApplicationView = {
  id: string;
  applicant_id: string;
  proposed_slug: string;
  proposed_name: string;
  course_name: string;
  institution: string | null;
  lecturer_name: string | null;
  semester: string;
  academic_year: string;
  description: string;
  reason: string;
  supporting_info: string | null;
  status: ClassApplicationStatus;
  reviewed_at: string | null;
  decision_note: string | null;
  created_class_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLogView = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  class_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const CLASS_COLUMNS =
  "id, slug, name, description, course_name, institution, lecturer_name, semester, academic_year, status, created_at, updated_at";

const APPLICATION_COLUMNS =
  "id, applicant_id, proposed_slug, proposed_name, course_name, institution, lecturer_name, semester, academic_year, description, reason, supporting_info, status, reviewed_at, decision_note, created_class_id, created_at, updated_at";

type ProfileMap = Map<
  string,
  { display_name: string; avatar_url: string | null }
>;

/** Public class discovery. Only active classes are returned by the function. */
export async function listClasses(
  query: ClassDiscoveryQuery,
): Promise<PaginatedResult<ClassListItem>> {
  const supabase = await createSupabaseServerClient();
  const offset = (query.page - 1) * query.pageSize;

  const { data, error } = await supabase.rpc("list_classes", {
    p_search: query.search ?? null,
    p_semester: query.semester ?? null,
    p_limit: query.pageSize,
    p_offset: offset,
  });

  if (error) {
    throw new DataAccessError("Could not load classes", error.code);
  }

  const rows = data ?? [];
  const total = rows[0]?.total_count ?? 0;

  return {
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      course_name: row.course_name,
      institution: row.institution,
      lecturer_name: row.lecturer_name,
      semester: row.semester,
      academic_year: row.academic_year,
      created_at: row.created_at,
      member_count: Number(row.member_count),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getClassBySlug(
  slug: string,
): Promise<ClassSummary | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select(CLASS_COLUMNS)
    .eq("slug", slug)
    .maybeSingle<ClassSummary>();

  if (error) {
    throw new DataAccessError("Could not load the class", error.code);
  }

  return data;
}

export async function getClassById(id: string): Promise<ClassSummary | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select(CLASS_COLUMNS)
    .eq("id", id)
    .maybeSingle<ClassSummary>();

  if (error) {
    throw new DataAccessError("Could not load the class", error.code);
  }

  return data;
}

/** Platform-admin predicate for routes that are not scoped to one class. */
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("is_platform_admin", {});

  if (error) {
    throw new DataAccessError("Could not resolve permissions", error.code);
  }

  return data === true;
}

export async function listMyClasses(userId: string): Promise<MyClassSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_members")
    .select(
      `joined_at,
       classes!class_members_class_id_fkey ( id, slug, name, course_name, semester, academic_year, status )`,
    )
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new DataAccessError("Could not load your classes", error.code);
  }

  const classIds = (data ?? []).flatMap((row) =>
    row.classes ? [row.classes.id] : [],
  );
  const adminIds = await loadAdminClassIds(classIds, userId);

  return (data ?? []).flatMap((row) => {
    if (!row.classes) {
      return [];
    }

    return [
      {
        id: row.classes.id,
        slug: row.classes.slug,
        name: row.classes.name,
        course_name: row.classes.course_name,
        semester: row.classes.semester,
        academic_year: row.classes.academic_year,
        status: row.classes.status,
        joined_at: row.joined_at,
        is_admin: adminIds.has(row.classes.id),
      },
    ];
  });
}

/**
 * Resolves what the current session may do inside one class.
 *
 * The three predicates run server-side, so a caller cannot claim a role by
 * sending a different id: `auth.uid()` is the verified session identity.
 */
export async function getClassRole(classId: string): Promise<ClassRole> {
  const supabase = await createSupabaseServerClient();

  const [platformAdmin, member, admin] = await Promise.all([
    supabase.rpc("is_platform_admin", {}),
    supabase.rpc("is_class_member", { p_class_id: classId }),
    supabase.rpc("is_class_admin", { p_class_id: classId }),
  ]);

  if (platformAdmin.error || member.error || admin.error) {
    throw new DataAccessError(
      "Could not resolve class permissions",
      platformAdmin.error?.code ?? member.error?.code ?? admin.error?.code,
    );
  }

  const isPlatformAdmin = platformAdmin.data === true;
  const isAdmin = admin.data === true;

  return {
    isPlatformAdmin,
    isMember: member.data === true,
    isAdmin,
    canManage: isPlatformAdmin || isAdmin,
  };
}

export async function listClassMembers(
  classId: string,
): Promise<ClassMemberView[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_members")
    .select("user_id, joined_via, joined_at")
    .eq("class_id", classId)
    .order("joined_at", { ascending: true })
    .limit(500);

  if (error) {
    throw new DataAccessError("Could not load class members", error.code);
  }

  const userIds = (data ?? []).map((row) => row.user_id);
  const [profiles, adminIds] = await Promise.all([
    loadProfiles(userIds),
    loadAdminUserIds(classId),
  ]);

  return (data ?? []).map((row) => ({
    user_id: row.user_id,
    display_name: profiles.get(row.user_id)?.display_name ?? "StarsTask member",
    avatar_url: profiles.get(row.user_id)?.avatar_url ?? null,
    joined_via: row.joined_via,
    joined_at: row.joined_at,
    is_admin: adminIds.has(row.user_id),
  }));
}

export async function listClassInvitations(
  classId: string,
): Promise<ClassInvitationView[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_invitations")
    .select(
      "id, email_restriction, expires_at, max_uses, used_count, revoked_at, created_at",
    )
    .eq("class_id", classId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new DataAccessError("Could not load invitations", error.code);
  }

  return data ?? [];
}

export async function listMyApplications(
  userId: string,
): Promise<ClassApplicationView[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_applications")
    .select(APPLICATION_COLUMNS)
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new DataAccessError("Could not load your applications", error.code);
  }

  return data ?? [];
}

export type ClassOption = {
  id: string;
  slug: string;
  name: string;
  semester: string;
};

/** Active classes for filter controls. Public metadata only. */
export async function getClassOptions(): Promise<ClassOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, slug, name, semester")
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(200);

  if (error) {
    throw new DataAccessError("Could not load classes", error.code);
  }

  return data ?? [];
}

/** Distinct semesters among active classes, for the discovery filter. */
export async function getClassSemesterOptions(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select("semester")
    .eq("status", "active")
    .limit(500);

  if (error) {
    throw new DataAccessError("Could not load semesters", error.code);
  }

  return [...new Set((data ?? []).map((row) => row.semester))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Platform-admin listing that includes archived classes. */
export async function listAllClasses(): Promise<ClassSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select(CLASS_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new DataAccessError("Could not load classes", error.code);
  }

  return data ?? [];
}

export type ApplicationReviewView = {
  id: string;
  decision: "approved" | "rejected";
  note: string | null;
  created_at: string;
};

/** Decision history for one application, readable by the applicant and admins. */
export async function listApplicationReviews(
  applicationId: string,
): Promise<ApplicationReviewView[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_application_reviews")
    .select("id, decision, note, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new DataAccessError(
      "Could not load the decision history",
      error.code,
    );
  }

  return data ?? [];
}

export async function getApplicationById(
  applicationId: string,
): Promise<ClassApplicationView | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_applications")
    .select(APPLICATION_COLUMNS)
    .eq("id", applicationId)
    .maybeSingle<ClassApplicationView>();

  if (error) {
    throw new DataAccessError("Could not load the application", error.code);
  }

  return data;
}

export async function listApplicationsForReview(
  status: ClassApplicationStatus | "all",
  page: number,
  pageSize: number,
): Promise<PaginatedResult<ClassApplicationView>> {
  const supabase = await createSupabaseServerClient();
  const offset = (page - 1) * pageSize;

  let request = supabase
    .from("class_applications")
    .select(APPLICATION_COLUMNS, { count: "exact" });

  if (status !== "all") {
    request = request.eq("status", status);
  }

  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw new DataAccessError("Could not load applications", error.code);
  }

  const total = count ?? 0;

  return {
    items: data ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listAuditLogs(options: {
  classId?: string | null;
  page: number;
  pageSize: number;
}): Promise<PaginatedResult<AuditLogView>> {
  const supabase = await createSupabaseServerClient();
  const offset = (options.page - 1) * options.pageSize;

  let request = supabase
    .from("audit_logs")
    .select(
      "id, action, entity_type, entity_id, class_id, metadata, created_at",
      { count: "exact" },
    );

  if (options.classId) {
    request = request.eq("class_id", options.classId);
  }

  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .range(offset, offset + options.pageSize - 1);

  if (error) {
    throw new DataAccessError("Could not load the audit trail", error.code);
  }

  const total = count ?? 0;

  return {
    items: (data ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      class_id: row.class_id,
      metadata: isRecord(row.metadata) ? row.metadata : {},
      created_at: row.created_at,
    })),
    total,
    page: options.page,
    pageSize: options.pageSize,
    totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
  };
}

export async function loadProfiles(userIds: string[]): Promise<ProfileMap> {
  const unique = [...new Set(userIds)];

  if (unique.length === 0) {
    return new Map();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", unique);

  if (error) {
    throw new DataAccessError("Could not load profiles", error.code);
  }

  return new Map(
    (data ?? []).map((row) => [
      row.id,
      { display_name: row.display_name, avatar_url: row.avatar_url },
    ]),
  );
}

async function loadAdminUserIds(classId: string): Promise<Set<string>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_admins")
    .select("user_id")
    .eq("class_id", classId);

  if (error) {
    throw new DataAccessError("Could not load class admins", error.code);
  }

  return new Set((data ?? []).map((row) => row.user_id));
}

async function loadAdminClassIds(
  classIds: string[],
  userId: string,
): Promise<Set<string>> {
  if (classIds.length === 0) {
    return new Set();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_admins")
    .select("class_id")
    .eq("user_id", userId)
    .in("class_id", classIds);

  if (error) {
    throw new DataAccessError("Could not load class admins", error.code);
  }

  return new Set((data ?? []).map((row) => row.class_id));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

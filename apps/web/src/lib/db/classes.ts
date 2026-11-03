import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassApplicationStatus,
  ClassDependencySummary,
  ClassDiscoveryQuery,
  ClassDuplicateCheckInput,
  ClassDuplicateMatch,
  ClassJoinPolicy,
  ClassLifecycleStatus,
  ClassMembersQuery,
  ClassStatus,
  ClassSubjectCreateInput,
  ClassSubjectUpdateInput,
  ClassSubjectView,
  ClassSubjectWithTaskCount,
} from "@starstask/contracts";

import { DataAccessError, type PaginatedResult } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ClassListItem = {
  id: string;
  slug: string;
  name: string;
  class_code: string | null;
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
  class_code: string | null;
  description: string;
  course_name: string;
  institution: string | null;
  lecturer_name: string | null;
  semester: string;
  academic_year: string;
  status: ClassLifecycleStatus;
  archived_at: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
};

export type MyClassSummary = {
  id: string;
  slug: string;
  name: string;
  class_code: string | null;
  course_name: string;
  semester: string;
  academic_year: string;
  status: ClassLifecycleStatus;
  joined_at: string;
  is_admin: boolean;
  subject_count?: number;
  admin_name?: string | null;
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
  /** Short self-introduction; null when the member has not written one. */
  bio: string | null;
  joined_via:
    "invitation" | "admin_assignment" | "platform_assignment" | "name_match";
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
  proposed_class_code: string | null;
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
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  class_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const CLASS_COLUMNS =
  "id, slug, name, class_code, description, course_name, institution, lecturer_name, semester, academic_year, status, archived_at, avatar_url, cover_url, created_at, updated_at";

const APPLICATION_COLUMNS =
  "id, applicant_id, proposed_slug, proposed_name, proposed_class_code, course_name, institution, lecturer_name, semester, academic_year, description, reason, supporting_info, status, reviewed_at, decision_note, created_class_id, created_at, updated_at";

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
      class_code: row.class_code,
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

/**
 * Classes in the same academic period and institution whose normalized code or
 * name matches. The result is a warning, never an automatic merge; a platform
 * admin still decides whether to create another class.
 */
export async function findClassDuplicates(
  input: ClassDuplicateCheckInput,
): Promise<ClassDuplicateMatch[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("find_class_duplicates", {
    p_name: input.name,
    p_class_code: input.classCode ?? null,
    p_academic_year: input.academicYear,
    p_semester: input.semester,
    p_institution: input.institution ?? null,
    p_exclude_class_id: input.excludeClassId ?? null,
  });

  if (error) {
    throw new DataAccessError(
      "Could not check for duplicate classes",
      error.code,
    );
  }

  return (data ?? []).map((row) => ({
    classId: row.class_id,
    slug: row.slug,
    name: row.name,
    classCode: row.class_code,
    academicYear: row.academic_year,
    semester: row.semester,
    institution: row.institution,
    status: row.status,
    codeMatch: row.code_match,
    nameMatch: row.name_match,
  }));
}

/**
 * Counts every row that depends on a class. Used by the delete confirmation and
 * by the API before it attempts a permanent delete.
 */
export async function getClassDependencies(
  classId: string,
): Promise<ClassDependencySummary | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_class_dependencies", {
    p_class_id: classId,
  });

  if (error) {
    throw new DataAccessError(
      "Could not load the class dependencies",
      error.code,
    );
  }

  const row = data?.[0];

  if (!row) {
    return null;
  }

  return {
    classStatus: row.class_status,
    memberCount: Number(row.member_count),
    assignmentCount: Number(row.assignment_count),
    submissionCount: Number(row.submission_count),
    sessionCount: Number(row.session_count),
    attendanceCount: Number(row.attendance_count),
    scheduleCount: Number(row.schedule_count),
    calendarEventCount: Number(row.calendar_event_count),
    leaveRequestCount: Number(row.leave_request_count),
    subjectCount: Number(row.subject_count),
    invitationCount: Number(row.invitation_count),
    hasHistory: row.has_history,
    canDelete: row.can_delete,
  };
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

/**
 * Whether the user administers at least one class. This only decides whether
 * leader destinations (such as the Action center) are rendered in navigation;
 * every class-admin route still re-checks the per-class role server-side.
 */
export async function isClassAdminAnywhere(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_admins")
    .select("class_id")
    .eq("user_id", userId)
    .limit(1);

  if (error) {
    throw new DataAccessError(
      "Could not resolve class admin status",
      error.code,
    );
  }

  return (data ?? []).length > 0;
}

/**
 * `join_policy` is granted to signed-in users only, so it stays out of
 * `CLASS_COLUMNS` and the anonymous class page never reads it.
 */
export async function getClassJoinPolicy(
  classId: string,
): Promise<ClassJoinPolicy | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select("join_policy")
    .eq("id", classId)
    .maybeSingle<{ join_policy: ClassJoinPolicy }>();

  if (error) {
    throw new DataAccessError(
      "Could not load the class join policy",
      error.code,
    );
  }

  return data?.join_policy ?? null;
}

export async function listMyClasses(userId: string): Promise<MyClassSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_members")
    .select(
      `joined_at,
       classes!class_members_class_id_fkey ( id, slug, name, class_code, course_name, semester, academic_year, status )`,
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
  const [adminIds, adminNames, subjectCounts] = await Promise.all([
    loadAdminClassIds(classIds, userId),
    loadAdminNamesByClass(classIds),
    countClassSubjects(classIds),
  ]);

  return (data ?? []).flatMap((row) => {
    if (!row.classes) {
      return [];
    }

    return [
      {
        id: row.classes.id,
        slug: row.classes.slug,
        name: row.classes.name,
        class_code: row.classes.class_code,
        course_name: row.classes.course_name,
        semester: row.classes.semester,
        academic_year: row.classes.academic_year,
        status: row.classes.status,
        joined_at: row.joined_at,
        is_admin: adminIds.has(row.classes.id),
        subject_count: subjectCounts.get(row.classes.id) ?? 0,
        admin_name: adminNames.get(row.classes.id) ?? null,
      },
    ];
  });
}

export type ClassDirectoryItem = {
  id: string;
  slug: string;
  name: string;
  class_code: string | null;
  description: string;
  course_name: string;
  institution: string | null;
  lecturer_name: string | null;
  semester: string;
  academic_year: string;
  status: ClassLifecycleStatus;
  archived_at: string | null;
  joined_at: string;
  is_admin: boolean;
  /** Published assignments in this class, counted server-side. */
  published_count: number;
  /** Active subjects in this class. */
  subject_count: number;
  /** Active members of this class. */
  member_count: number;
  admin_name?: string | null;
};

const CLASS_DIRECTORY_LIMIT = 100;

/**
 * Every class the caller belongs to, with its published-assignment count.
 *
 * Membership is the visibility rule: RLS on `class_members` returns only the
 * caller's rows, so a different user's classes never reach this function even
 * if a userId is passed in from the client.
 */
export async function listMyClassDirectory(
  userId: string,
): Promise<ClassDirectoryItem[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_members")
    .select(
      `joined_at,
       classes!class_members_class_id_fkey ( id, slug, name, class_code, description, course_name, institution, lecturer_name, semester, academic_year, status, archived_at )`,
    )
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(CLASS_DIRECTORY_LIMIT);

  if (error) {
    throw new DataAccessError("Could not load your classes", error.code);
  }

  const memberships = (data ?? []).flatMap((row) =>
    row.classes ? [{ ...row.classes, joined_at: row.joined_at }] : [],
  );

  if (memberships.length === 0) {
    return [];
  }

  const classIds = memberships.map((membership) => membership.id);
  const [adminIds, publishedCounts, adminNames, subjectCounts, memberCounts] =
    await Promise.all([
      loadAdminClassIds(classIds, userId),
      countPublishedAssignmentsByClass(classIds),
      loadAdminNamesByClass(classIds),
      countClassSubjects(classIds),
      countClassMembers(classIds),
    ]);

  return memberships.map((membership) => ({
    id: membership.id,
    slug: membership.slug,
    name: membership.name,
    class_code: membership.class_code,
    description: membership.description,
    course_name: membership.course_name,
    institution: membership.institution,
    lecturer_name: membership.lecturer_name,
    semester: membership.semester,
    academic_year: membership.academic_year,
    status: membership.status,
    archived_at: membership.archived_at,
    joined_at: membership.joined_at,
    is_admin: adminIds.has(membership.id),
    published_count: publishedCounts.get(membership.id) ?? 0,
    subject_count: subjectCounts.get(membership.id) ?? 0,
    member_count: memberCounts.get(membership.id) ?? 0,
    admin_name: adminNames.get(membership.id) ?? null,
  }));
}

/** One request per class, matching the dashboard's exact-count approach. */
async function countPublishedAssignmentsByClass(
  classIds: string[],
): Promise<Map<string, number>> {
  const supabase = await createSupabaseServerClient();

  const results = await Promise.all(
    classIds.map((classId) =>
      supabase
        .from("assignments")
        .select("id", { count: "exact", head: true })
        .eq("class_id", classId)
        .eq("status", "published"),
    ),
  );

  const counts = new Map<string, number>();

  results.forEach((result, index) => {
    const classId = classIds[index];

    if (result.error) {
      throw new DataAccessError(
        "Could not count class assignments",
        result.error.code,
      );
    }

    if (classId) {
      counts.set(classId, result.count ?? 0);
    }
  });

  return counts;
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
  const [profiles, adminIds, bios] = await Promise.all([
    loadProfiles(userIds),
    loadAdminUserIds(classId),
    loadClassMemberBios(classId),
  ]);

  return (data ?? []).map((row) => ({
    user_id: row.user_id,
    display_name: profiles.get(row.user_id)?.display_name ?? "StarsTask member",
    avatar_url: profiles.get(row.user_id)?.avatar_url ?? null,
    bio: bios.get(row.user_id) ?? null,
    joined_via: row.joined_via,
    joined_at: row.joined_at,
    is_admin: adminIds.has(row.user_id),
  }));
}

/**
 * Bios are read through a class-scoped RPC, so they never become a global
 * column grant on `profiles`. A caller outside the class is rejected by the
 * database even if they guess the id.
 */
async function loadClassMemberBios(
  classId: string,
): Promise<Map<string, string>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_class_member_bios", {
    p_class_id: classId,
  });

  if (error) {
    throw new DataAccessError("Could not load member bios", error.code);
  }

  const bios = new Map<string, string>();

  for (const row of data ?? []) {
    if (row.bio) {
      bios.set(row.user_id, row.bio);
    }
  }

  return bios;
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

export async function listApplicationsForReview(options: {
  status: ClassApplicationStatus | "all";
  search?: string;
  page: number;
  pageSize: number;
}): Promise<PaginatedResult<ClassApplicationView>> {
  const { status, search, page, pageSize } = options;
  const supabase = await createSupabaseServerClient();
  const offset = (page - 1) * pageSize;

  let request = supabase
    .from("class_applications")
    .select(APPLICATION_COLUMNS, { count: "exact" });

  if (status !== "all") {
    request = request.eq("status", status);
  }

  if (search) {
    request = request.ilike("proposed_name", `%${search}%`);
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
      "id, actor_id, action, entity_type, entity_id, class_id, metadata, created_at",
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
  const rows = data ?? [];
  const profiles = await loadProfiles(
    rows.flatMap((row) => (row.actor_id ? [row.actor_id] : [])),
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      actor_id: row.actor_id,
      actor_name: row.actor_id
        ? (profiles.get(row.actor_id)?.display_name ?? null)
        : null,
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

export async function loadAdminNamesByClass(
  classIds: string[],
): Promise<Map<string, string>> {
  if (classIds.length === 0) {
    return new Map();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_admins")
    .select("class_id, user_id")
    .in("class_id", classIds);

  if (error || !data) {
    return new Map();
  }

  const userIds = [...new Set(data.map((r) => r.user_id))];
  const profiles = await loadProfiles(userIds);

  const adminNames = new Map<string, string>();
  for (const row of data) {
    if (!adminNames.has(row.class_id)) {
      const profile = profiles.get(row.user_id);
      if (profile?.display_name) {
        adminNames.set(row.class_id, profile.display_name);
      }
    }
  }

  return adminNames;
}

export async function countClassSubjects(
  classIds: string[],
): Promise<Map<string, number>> {
  if (classIds.length === 0) {
    return new Map();
  }

  const supabase = await createSupabaseServerClient();
  const results = await Promise.all(
    classIds.map((classId) =>
      supabase
        .from("class_subjects")
        .select("id", { count: "exact", head: true })
        .eq("class_id", classId)
        .eq("status", "active"),
    ),
  );

  const counts = new Map<string, number>();
  results.forEach((result, index) => {
    const classId = classIds[index];

    if (result.error) {
      throw new DataAccessError(
        "Could not count class subjects",
        result.error.code,
      );
    }

    if (classId) {
      // A class with no subjects has zero subjects. Reporting 1 here invented a
      // statistic that the database never held.
      counts.set(classId, result.count ?? 0);
    }
  });

  return counts;
}

/** Active members of each class. `class_members` has no inactive rows. */
async function countClassMembers(
  classIds: string[],
): Promise<Map<string, number>> {
  if (classIds.length === 0) {
    return new Map();
  }

  const supabase = await createSupabaseServerClient();
  const results = await Promise.all(
    classIds.map((classId) =>
      supabase
        .from("class_members")
        .select("user_id", { count: "exact", head: true })
        .eq("class_id", classId),
    ),
  );

  const counts = new Map<string, number>();
  results.forEach((result, index) => {
    const classId = classIds[index];

    if (result.error) {
      throw new DataAccessError(
        "Could not count class members",
        result.error.code,
      );
    }

    if (classId) {
      counts.set(classId, result.count ?? 0);
    }
  });

  return counts;
}

export type ClassCourseSummary = {
  id: string;
  name: string;
  code: string | null;
};

/**
 * Active courses of several classes in a single query.
 *
 * A class can hold more than one course, and a caller that only has a list of
 * classes would otherwise need one query per class just to name them.
 */
export async function listActiveCoursesByClass(
  classIds: string[],
): Promise<Map<string, ClassCourseSummary[]>> {
  const courses = new Map<string, ClassCourseSummary[]>();

  if (classIds.length === 0) {
    return courses;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_subjects")
    .select("id, class_id, name, code")
    .in("class_id", classIds)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new DataAccessError("Could not load class courses", error.code);
  }

  for (const row of data ?? []) {
    const list = courses.get(row.class_id) ?? [];
    list.push({ id: row.id, name: row.name, code: row.code });
    courses.set(row.class_id, list);
  }

  return courses;
}

export async function listClassSubjects(
  classId: string,
  options?: { includeArchived?: boolean },
): Promise<ClassSubjectWithTaskCount[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("class_subjects")
    .select(
      "id, class_id, course_id, name, code, description, lecturer_name, status, created_at, updated_at",
    )
    .eq("class_id", classId);

  if (!options?.includeArchived) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) {
    throw new DataAccessError("Could not load class subjects", error.code);
  }

  const subjects = data ?? [];

  if (subjects.length === 0) {
    const classRow = await getClassById(classId);
    if (classRow) {
      const taskCount = await countPublishedAssignmentsByClass([classId]);
      return [
        {
          id: classRow.id,
          class_id: classRow.id,
          course_id: null,
          name: classRow.course_name,
          code: null,
          description: classRow.description,
          lecturer_name: classRow.lecturer_name,
          status: classRow.status === "archived" ? "archived" : "active",
          created_at: classRow.created_at,
          updated_at: classRow.updated_at,
          task_count: taskCount.get(classId) ?? 0,
        },
      ];
    }
  }

  const subjectIds = subjects.map((s) => s.id);
  const taskCountResults = await Promise.all(
    subjectIds.map((subjectId) =>
      supabase
        .from("assignments")
        .select("id", { count: "exact", head: true })
        .eq("subject_id", subjectId)
        .eq("status", "published"),
    ),
  );

  return subjects.map((subject, index) => ({
    id: subject.id,
    class_id: subject.class_id,
    course_id: subject.course_id,
    name: subject.name,
    code: subject.code,
    description: subject.description,
    lecturer_name: subject.lecturer_name,
    status: subject.status as ClassStatus,
    created_at: subject.created_at,
    updated_at: subject.updated_at,
    task_count: taskCountResults[index]?.count ?? 0,
  }));
}

export async function getClassSubjectById(
  subjectId: string,
): Promise<ClassSubjectView | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("class_subjects")
    .select(
      "id, class_id, course_id, name, code, description, lecturer_name, status, created_at, updated_at",
    )
    .eq("id", subjectId)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not load subject", error.code);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    class_id: data.class_id,
    course_id: data.course_id,
    name: data.name,
    code: data.code,
    description: data.description,
    lecturer_name: data.lecturer_name,
    status: data.status as ClassStatus,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Thrown when a course code is already used by another course in the same
 * class group. The unique index `class_subjects_class_code_uniq` is the hard
 * guarantee; this typed error exists so routes can answer 409 with a message
 * instead of leaking a Postgres constraint failure.
 */
export class DuplicateSubjectCodeError extends Error {
  constructor() {
    super("A course with this code already exists in this class group");
    this.name = "DuplicateSubjectCodeError";
  }
}

/** Codes are compared trim- and case-insensitively, matching the DB index. */
function normalizeSubjectCode(code: string): string {
  return code.trim().toLowerCase();
}

async function findSubjectWithCode(
  supabase: SupabaseClient<Database>,
  classId: string,
  code: string,
  excludeSubjectId?: string,
): Promise<boolean> {
  const normalized = normalizeSubjectCode(code);
  const { data, error } = await supabase
    .from("class_subjects")
    .select("id, code")
    .eq("class_id", classId)
    .not("code", "is", null);

  if (error) {
    throw new DataAccessError("Could not check course codes", error.code);
  }

  return (data ?? []).some(
    (row) =>
      row.id !== excludeSubjectId &&
      row.code !== null &&
      normalizeSubjectCode(row.code) === normalized,
  );
}

export async function createClassSubject(
  classId: string,
  input: ClassSubjectCreateInput,
): Promise<string> {
  const supabase = await createSupabaseServerClient();

  if (input.code) {
    const taken = await findSubjectWithCode(supabase, classId, input.code);

    if (taken) {
      throw new DuplicateSubjectCodeError();
    }
  }

  const { data, error } = await supabase.rpc("create_class_subject", {
    p_class_id: classId,
    p_name: input.name,
    p_code: input.code ?? null,
    p_description: input.description ?? null,
    p_lecturer_name: input.lecturerName ?? null,
  });

  if (error || !data) {
    // The unique index is the race-safe backstop for two admins submitting
    // the same code at once; surface it as the same friendly failure.
    if (error?.code === "23505") {
      throw new DuplicateSubjectCodeError();
    }

    throw new DataAccessError("Could not create class subject", error?.code);
  }

  return data;
}

export async function updateClassSubject(
  subjectId: string,
  input: ClassSubjectUpdateInput,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  if (input.code) {
    const subject = await getClassSubjectById(subjectId);

    if (!subject) {
      throw new DataAccessError("Could not update class subject", "P0002");
    }

    const taken = await findSubjectWithCode(
      supabase,
      subject.class_id,
      input.code,
      subjectId,
    );

    if (taken) {
      throw new DuplicateSubjectCodeError();
    }
  }

  const { data, error } = await supabase.rpc("update_class_subject", {
    p_subject_id: subjectId,
    p_name: input.name ?? "",
    p_code: input.code ?? null,
    p_description: input.description ?? null,
    p_lecturer_name: input.lecturerName ?? null,
    p_status: input.status ?? "active",
  });

  if (error) {
    if (error.code === "23505") {
      throw new DuplicateSubjectCodeError();
    }

    throw new DataAccessError("Could not update class subject", error.code);
  }

  return data === true;
}

export async function deleteClassSubject(subjectId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("delete_class_subject", {
    p_subject_id: subjectId,
  });

  if (error) {
    throw new DataAccessError("Could not delete class subject", error.code);
  }

  return data === true;
}

export async function listClassMembersPaginated(
  classId: string,
  options: ClassMembersQuery,
): Promise<PaginatedResult<ClassMemberView>> {
  const supabase = await createSupabaseServerClient();
  const offset = (options.page - 1) * options.pageSize;

  const { data, error, count } = await supabase
    .from("class_members")
    .select("user_id, joined_via, joined_at", { count: "exact" })
    .eq("class_id", classId)
    .order("joined_at", { ascending: true })
    .range(offset, offset + options.pageSize - 1);

  if (error) {
    throw new DataAccessError("Could not load class members", error.code);
  }

  const rows = data ?? [];
  const userIds = rows.map((r) => r.user_id);
  const [profiles, adminIds] = await Promise.all([
    loadProfiles(userIds),
    loadAdminUserIds(classId),
  ]);

  let items: ClassMemberView[] = rows.map((row) => {
    const profile = profiles.get(row.user_id);
    return {
      user_id: row.user_id,
      display_name: profile?.display_name ?? "StarsTask member",
      avatar_url: profile?.avatar_url ?? null,
      bio: null,
      joined_via: row.joined_via as ClassMemberView["joined_via"],
      joined_at: row.joined_at,
      is_admin: adminIds.has(row.user_id),
    };
  });

  if (options.search) {
    const searchLower = options.search.toLowerCase();
    items = items.filter((item) =>
      item.display_name.toLowerCase().includes(searchLower),
    );
  }

  const total = count ?? items.length;

  return {
    items,
    total,
    page: options.page,
    pageSize: options.pageSize,
    totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
  };
}

/**
 * Points the class at a new profile image and/or cover image.
 *
 * Both values are written together, so the caller passes the full desired
 * state: a `null` clears that image. Authorization lives in the database
 * function, which requires class admin rights for this class.
 */
export async function setClassMedia(
  classId: string,
  media: { avatarUrl: string | null; coverUrl: string | null },
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_class_media", {
    p_class_id: classId,
    p_avatar_url: media.avatarUrl,
    p_cover_url: media.coverUrl,
  });

  if (error) {
    throw new DataAccessError("Could not save the class image", error.code);
  }
}

/** One course inside a class group, or null when it does not belong to it. */
export async function getClassSubject(
  classId: string,
  subjectId: string,
): Promise<ClassSubjectView | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_subjects")
    .select(
      "id, class_id, course_id, name, code, description, lecturer_name, status, created_at, updated_at",
    )
    .eq("id", subjectId)
    .eq("class_id", classId)
    .maybeSingle<ClassSubjectView>();

  if (error) {
    throw new DataAccessError("Could not load the course", error.code);
  }

  return data;
}

/**
 * Published assignment counts keyed by course id.
 *
 * One grouped query instead of a count per course, because the courses page
 * needs the number for every row at once.
 */
export async function countPublishedAssignmentsBySubject(
  classId: string,
): Promise<Map<string, number>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("subject_id")
    .eq("class_id", classId)
    .eq("status", "published")
    .not("subject_id", "is", null);

  if (error) {
    throw new DataAccessError("Could not count course assignments", error.code);
  }

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    if (!row.subject_id) {
      continue;
    }

    counts.set(row.subject_id, (counts.get(row.subject_id) ?? 0) + 1);
  }

  return counts;
}

export type CourseContentType = "lecturer_assignment" | "class_announcement";

export type CourseAssignmentSummary = {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  status: string;
  content_type: CourseContentType;
  source_label: string | null;
  created_at: string;
  published_at: string | null;
  attachment_count: number;
};

/**
 * Published content that belongs to one course.
 *
 * Filtering on both ids keeps a course page from ever showing work that belongs
 * to a sibling course in the same class group, and `contentType` separates the
 * course's assignments from its announcements.
 */
export async function listCourseAssignments(
  classId: string,
  subjectId: string,
  options?: { contentType?: CourseContentType; limit?: number },
): Promise<CourseAssignmentSummary[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("assignments")
    .select(
      "id, title, description, deadline, status, content_type, source_label, created_at, published_at, assignment_attachments ( id )",
    )
    .eq("class_id", classId)
    .eq("subject_id", subjectId)
    .eq("status", "published");

  if (options?.contentType) {
    query = query.eq("content_type", options.contentType);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 20);

  if (error) {
    throw new DataAccessError("Could not load course assignments", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    deadline: row.deadline,
    status: row.status,
    content_type: row.content_type as CourseContentType,
    source_label: row.source_label,
    created_at: row.created_at,
    published_at: row.published_at,
    attachment_count: row.assignment_attachments.length,
  }));
}

export type CourseContentCounts = {
  assignments: number;
  announcements: number;
  materials: number;
};

/** Published, course-scoped counts for the course overview. */
export async function countCourseContent(
  classId: string,
  subjectId: string,
): Promise<CourseContentCounts> {
  const supabase = await createSupabaseServerClient();

  const [assignments, materials] = await Promise.all([
    supabase
      .from("assignments")
      .select("content_type")
      .eq("class_id", classId)
      .eq("subject_id", subjectId)
      .eq("status", "published"),
    supabase
      .from("course_materials")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId)
      .eq("subject_id", subjectId),
  ]);

  if (assignments.error) {
    throw new DataAccessError(
      "Could not count course assignments",
      assignments.error.code,
    );
  }

  if (materials.error) {
    throw new DataAccessError(
      "Could not count course materials",
      materials.error.code,
    );
  }

  let assignmentCount = 0;
  let announcementCount = 0;

  for (const row of assignments.data ?? []) {
    if (row.content_type === "class_announcement") {
      announcementCount += 1;
    } else {
      assignmentCount += 1;
    }
  }

  return {
    assignments: assignmentCount,
    announcements: announcementCount,
    materials: materials.count ?? 0,
  };
}

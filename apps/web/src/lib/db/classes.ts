import "server-only";

import type {
  ClassApplicationStatus,
  ClassDiscoveryQuery,
  ClassMembersQuery,
  ClassStatus,
  ClassSubjectCreateInput,
  ClassSubjectUpdateInput,
  ClassSubjectView,
  ClassSubjectWithTaskCount,
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
        course_name: row.classes.course_name,
        semester: row.classes.semester,
        academic_year: row.classes.academic_year,
        status: row.classes.status,
        joined_at: row.joined_at,
        is_admin: adminIds.has(row.classes.id),
        subject_count: subjectCounts.get(row.classes.id) ?? 1,
        admin_name: adminNames.get(row.classes.id) ?? null,
      },
    ];
  });
}

export type ClassDirectoryItem = {
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
  joined_at: string;
  is_admin: boolean;
  /** Published assignments in this class, counted server-side. */
  published_count: number;
  subject_count?: number;
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
       classes!class_members_class_id_fkey ( id, slug, name, description, course_name, institution, lecturer_name, semester, academic_year, status )`,
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
  const [adminIds, publishedCounts, adminNames, subjectCounts] =
    await Promise.all([
      loadAdminClassIds(classIds, userId),
      countPublishedAssignmentsByClass(classIds),
      loadAdminNamesByClass(classIds),
      countClassSubjects(classIds),
    ]);

  return memberships.map((membership) => ({
    id: membership.id,
    slug: membership.slug,
    name: membership.name,
    description: membership.description,
    course_name: membership.course_name,
    institution: membership.institution,
    lecturer_name: membership.lecturer_name,
    semester: membership.semester,
    academic_year: membership.academic_year,
    status: membership.status,
    joined_at: membership.joined_at,
    is_admin: adminIds.has(membership.id),
    published_count: publishedCounts.get(membership.id) ?? 0,
    subject_count: subjectCounts.get(membership.id) ?? 1,
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
    if (classId) {
      counts.set(classId, result.count && result.count > 0 ? result.count : 1);
    }
  });

  return counts;
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
          status: classRow.status,
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

export async function createClassSubject(
  classId: string,
  input: ClassSubjectCreateInput,
): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("create_class_subject", {
    p_class_id: classId,
    p_name: input.name,
    p_code: input.code ?? null,
    p_description: input.description ?? null,
    p_lecturer_name: input.lecturerName ?? null,
  });

  if (error || !data) {
    throw new DataAccessError("Could not create class subject", error?.code);
  }

  return data;
}

export async function updateClassSubject(
  subjectId: string,
  input: ClassSubjectUpdateInput,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("update_class_subject", {
    p_subject_id: subjectId,
    p_name: input.name ?? "",
    p_code: input.code ?? null,
    p_description: input.description ?? null,
    p_lecturer_name: input.lecturerName ?? null,
    p_status: input.status ?? "active",
  });

  if (error) {
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

import "server-only";

import type {
  DeclaredPosition,
  VerificationQueueStatus,
  VerificationStatus,
} from "@starstask/contracts";

import { DataAccessError, type PaginatedResult } from "@/lib/db/assignments";
import { loadProfiles } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClassStatusRow, Json } from "@/types/database";

/**
 * Data access for class representative verification.
 *
 * All queries use the caller's own Supabase client, so RLS decides visibility.
 * No function here widens a query with an `or` clause or trusts a user id from
 * the browser.
 */

export type VerificationRequestView = {
  id: string;
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  classId: string;
  classSlug: string;
  className: string;
  classSemester: string;
  classStatus: ClassStatusRow;
  statement: string | null;
  status: VerificationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  revisionCount: number;
  evidenceCount: number;
  /** True when a class_admins row currently exists for this class. */
  hasClassAdminAccess: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VerificationEvidenceView = {
  id: string;
  requestId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
};

export type VerificationHistoryEntry = {
  id: string;
  action: string;
  previousStatus: VerificationStatus | null;
  newStatus: VerificationStatus | null;
  note: string | null;
  metadata: Json;
  createdAt: string;
};

export type VerificationQueueFilters = {
  search?: string;
  status: VerificationQueueStatus;
  classId?: string;
  semester?: string;
  page: number;
  pageSize: number;
};

const REQUEST_COLUMNS = `
  id,
  student_id,
  class_id,
  declared_position,
  statement,
  status,
  submitted_at,
  reviewed_at,
  review_note,
  revision_count,
  created_at,
  updated_at,
  classes!class_verification_requests_class_id_fkey ( id, slug, name, status, semester )
`;

type RequestRowShape = {
  id: string;
  student_id: string;
  class_id: string;
  declared_position: "class_representative";
  statement: string | null;
  status: VerificationStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  revision_count: number;
  created_at: string;
  updated_at: string;
  classes: {
    id: string;
    slug: string;
    name: string;
    status: ClassStatusRow;
    semester: string;
  } | null;
};

async function countActiveEvidence(
  requestIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (requestIds.length === 0) {
    return counts;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_verification_evidence")
    .select("request_id")
    .in("request_id", requestIds)
    .is("removed_at", null);

  if (error) {
    throw new DataAccessError("Could not count evidence", error.code);
  }

  for (const row of data ?? []) {
    counts.set(row.request_id, (counts.get(row.request_id) ?? 0) + 1);
  }

  return counts;
}

/**
 * Class admin rows for the students in a result page.
 *
 * A student's own RLS read only covers classes they belong to, which is exactly
 * the case after an approval. A platform admin sees every row.
 */
async function listClassAdminKeys(studentIds: string[]): Promise<Set<string>> {
  const keys = new Set<string>();

  if (studentIds.length === 0) {
    return keys;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_admins")
    .select("class_id, user_id")
    .in("user_id", studentIds);

  if (error) {
    throw new DataAccessError("Could not load class admin access", error.code);
  }

  for (const row of data ?? []) {
    keys.add(`${row.user_id}:${row.class_id}`);
  }

  return keys;
}

async function toViews(
  rows: RequestRowShape[],
  options: { withStudentName: boolean },
): Promise<VerificationRequestView[]> {
  const studentIds = [...new Set(rows.map((row) => row.student_id))];

  const [profiles, evidenceCounts, adminKeys] = await Promise.all([
    options.withStudentName
      ? loadProfiles(studentIds)
      : Promise.resolve(new Map()),
    countActiveEvidence(rows.map((row) => row.id)),
    listClassAdminKeys(studentIds),
  ]);

  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: profiles.get(row.student_id)?.display_name ?? "Student",
    studentAvatarUrl: profiles.get(row.student_id)?.avatar_url ?? null,
    classId: row.class_id,
    classSlug: row.classes?.slug ?? "",
    className: row.classes?.name ?? "Class",
    classSemester: row.classes?.semester ?? "",
    classStatus: row.classes?.status ?? "active",
    statement: row.statement,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    revisionCount: row.revision_count,
    evidenceCount: evidenceCounts.get(row.id) ?? 0,
    hasClassAdminAccess: adminKeys.has(`${row.student_id}:${row.class_id}`),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/** Resolves student ids whose nickname matches the search term. */
async function findStudentIds(term: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("display_name", `%${term.replace(/[%_]/g, "")}%`)
    .limit(100);

  if (error) {
    throw new DataAccessError("Could not search students", error.code);
  }

  return (data ?? []).map((row) => row.id);
}

/** Resolves class ids for a semester filter. */
async function findClassIdsBySemester(semester: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("semester", semester)
    .limit(500);

  if (error) {
    throw new DataAccessError("Could not filter by semester", error.code);
  }

  return (data ?? []).map((row) => row.id);
}

/**
 * The caller's own declared position.
 *
 * Read through the RPC because the profile column is not exposed to clients; a
 * value never grants anything.
 */
export async function getMyDeclaredPosition(): Promise<DeclaredPosition> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_my_declared_position", {});

  if (error) {
    throw new DataAccessError("Could not load your position", error.code);
  }

  return data === "class_representative" ? "class_representative" : "student";
}

/**
 * Class ids where the user currently holds the class admin (representative)
 * role. RLS only returns rows of classes the user belongs to.
 */
export async function listMyRepresentativeClassIds(
  userId: string,
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_admins")
    .select("class_id")
    .eq("user_id", userId);

  if (error) {
    throw new DataAccessError(
      "Could not load your class admin roles",
      error.code,
    );
  }

  return (data ?? []).map((row) => row.class_id);
}

/** A student's own requests, newest first. RLS limits rows to the caller. */
export async function listMyVerificationRequests(
  studentId: string,
): Promise<VerificationRequestView[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_verification_requests")
    .select(REQUEST_COLUMNS)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new DataAccessError(
      "Could not load your verification requests",
      error.code,
    );
  }

  return toViews((data ?? []) as unknown as RequestRowShape[], {
    withStudentName: false,
  });
}

export async function getVerificationRequestById(
  requestId: string,
): Promise<VerificationRequestView | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_verification_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw new DataAccessError(
      "Could not load the verification request",
      error.code,
    );
  }

  if (!data) {
    return null;
  }

  const [view] = await toViews([data as unknown as RequestRowShape], {
    withStudentName: true,
  });

  return view ?? null;
}

/** Submitted requests only; an unfinished draft never reaches a reviewer. */
export async function listVerificationQueue(
  filters: VerificationQueueFilters,
): Promise<PaginatedResult<VerificationRequestView>> {
  const supabase = await createSupabaseServerClient();
  const from = (filters.page - 1) * filters.pageSize;

  let query = supabase
    .from("class_verification_requests")
    .select(REQUEST_COLUMNS, { count: "exact" })
    .not("submitted_at", "is", null);

  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.classId) {
    query = query.eq("class_id", filters.classId);
  }

  if (filters.semester) {
    const classIds = await findClassIdsBySemester(filters.semester);

    if (classIds.length === 0) {
      return {
        items: [],
        total: 0,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: 0,
      };
    }

    query = query.in("class_id", classIds);
  }

  if (filters.search) {
    const studentIds = await findStudentIds(filters.search);

    if (studentIds.length === 0) {
      return {
        items: [],
        total: 0,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: 0,
      };
    }

    query = query.in("student_id", studentIds);
  }

  const { data, error, count } = await query
    .order("submitted_at", { ascending: false })
    .range(from, from + filters.pageSize - 1);

  if (error) {
    throw new DataAccessError(
      "Could not load the verification queue",
      error.code,
    );
  }

  const items = await toViews((data ?? []) as unknown as RequestRowShape[], {
    withStudentName: true,
  });
  const total = count ?? 0;

  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}

/** Active evidence only; removed rows stay for audit but are not shown. */
export async function listVerificationEvidence(
  requestId: string,
): Promise<VerificationEvidenceView[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_verification_evidence")
    .select(
      "id, request_id, storage_path, original_filename, mime_type, file_size, created_at",
    )
    .eq("request_id", requestId)
    .is("removed_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new DataAccessError("Could not load evidence", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    requestId: row.request_id,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  }));
}

export async function listVerificationHistory(
  requestId: string,
): Promise<VerificationHistoryEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_verification_reviews")
    .select(
      "id, action, previous_status, new_status, note, metadata, created_at",
    )
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new DataAccessError("Could not load the request history", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    note: row.note,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

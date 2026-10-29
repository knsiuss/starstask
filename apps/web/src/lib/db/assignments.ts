import "server-only";

import type {
  AssignmentCreateInput,
  AssignmentStatus,
  AssignmentUpdateInput,
  ListAssignmentsQuery,
  MyAssignmentsQuery,
} from "@starstask/contracts";

import type { Database, Json } from "@/types/database";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class DataAccessError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "DataAccessError";
  }
}

export type AssignmentAttachment = {
  id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

export type AssignmentDetail = {
  id: string;
  title: string;
  description: string;
  course_id: string;
  course_name: string;
  course_code: string | null;
  course_department: string | null;
  user_id: string;
  lecturer_name: string | null;
  semester: string | null;
  academic_year: string | null;
  assignment_type: string | null;
  deadline: string | null;
  tags: string[];
  reference_urls: string[];
  status: AssignmentStatus;
  created_at: string;
  updated_at: string;
  author_display_name: string;
  author_avatar_url: string | null;
  attachments: AssignmentAttachment[];
};

export type MyAssignment = {
  id: string;
  title: string;
  status: AssignmentStatus;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  course_name: string;
  course_code: string | null;
  attachment_count: number;
};

export type CourseOption = {
  id: string;
  name: string;
  code: string | null;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type AssignmentRecord = {
  id: string;
  title: string;
  description: string;
  course_id: string;
  user_id: string;
  lecturer_name: string | null;
  semester: string | null;
  academic_year: string | null;
  assignment_type: string | null;
  deadline: string | null;
  tags: string[];
  reference_urls: Json;
  status: AssignmentStatus;
  created_at: string;
  updated_at: string;
  courses: {
    name: string;
    code: string | null;
    department: string | null;
  } | null;
  assignment_attachments: AssignmentAttachment[];
};

const ASSIGNMENT_DETAIL_SELECT = `
  id,
  title,
  description,
  course_id,
  user_id,
  lecturer_name,
  semester,
  academic_year,
  assignment_type,
  deadline,
  tags,
  reference_urls,
  status,
  created_at,
  updated_at,
  courses!assignments_course_id_fkey ( name, code, department ),
  assignment_attachments ( id, storage_path, original_filename, mime_type, file_size, created_at )
`;

export async function listAssignments(
  query: ListAssignmentsQuery,
): Promise<
  PaginatedResult<
    Database["public"]["Functions"]["list_assignments"]["Returns"][number]
  >
> {
  const supabase = await createSupabaseServerClient();
  const offset = (query.page - 1) * query.pageSize;

  const { data, error } = await supabase.rpc("list_assignments", {
    p_search: query.search ?? null,
    p_course_id: query.course ?? null,
    p_semester: query.semester ?? null,
    p_type: query.type ?? null,
    p_tag: query.tag ?? null,
    p_sort: query.sort,
    p_limit: query.pageSize,
    p_offset: offset,
    p_class_id: query.class ?? null,
  });

  if (error) {
    throw new DataAccessError("Could not load assignments", error.code);
  }

  const items = data ?? [];
  const total = items[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages,
  };
}

export async function getAssignmentDetail(
  id: string,
): Promise<AssignmentDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle<AssignmentRecord>();

  if (error) {
    throw new DataAccessError("Could not load the assignment", error.code);
  }

  if (!data) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", data.user_id)
    .maybeSingle();

  return toAssignmentDetail(data, profile);
}

export async function getOwnedAssignment(
  id: string,
  userId: string,
): Promise<AssignmentDetail | null> {
  const assignment = await getAssignmentDetail(id);

  if (!assignment || assignment.user_id !== userId) {
    return null;
  }

  return assignment;
}

export async function getMyAssignments(
  userId: string,
  query: MyAssignmentsQuery,
): Promise<PaginatedResult<MyAssignment>> {
  const supabase = await createSupabaseServerClient();
  const offset = (query.page - 1) * query.pageSize;

  let request = supabase
    .from("assignments")
    .select(
      "id, title, status, deadline, created_at, updated_at, courses!assignments_course_id_fkey ( name, code ), assignment_attachments ( id )",
      { count: "exact" },
    )
    .eq("user_id", userId);

  if (query.status) {
    request = request.eq("status", query.status);
  }

  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .range(offset, offset + query.pageSize - 1);

  if (error) {
    throw new DataAccessError("Could not load your assignments", error.code);
  }

  const items = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status as AssignmentStatus,
    deadline: row.deadline,
    created_at: row.created_at,
    updated_at: row.updated_at,
    course_name: row.courses?.name ?? "Unknown course",
    course_code: row.courses?.code ?? null,
    attachment_count: row.assignment_attachments.length,
  }));

  const total = count ?? 0;

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getCourseOptions(): Promise<CourseOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, code")
    .order("name", { ascending: true })
    .limit(200);

  if (error) {
    throw new DataAccessError("Could not load courses", error.code);
  }

  return data ?? [];
}

export async function getSemesterOptions(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("semester")
    .eq("status", "published")
    .not("semester", "is", null)
    .limit(1000);

  if (error) {
    throw new DataAccessError("Could not load semesters", error.code);
  }

  const semesters = new Set<string>();

  for (const row of data ?? []) {
    if (row.semester) {
      semesters.add(row.semester);
    }
  }

  return [...semesters].sort((a, b) => a.localeCompare(b));
}

export async function getPublishedCounts(): Promise<{
  assignments: number;
  courses: number;
}> {
  const supabase = await createSupabaseServerClient();

  const [assignments, courses] = await Promise.all([
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase.from("courses").select("id", { count: "exact", head: true }),
  ]);

  if (assignments.error || courses.error) {
    throw new DataAccessError(
      "Could not load statistics",
      assignments.error?.code ?? courses.error?.code,
    );
  }

  return {
    assignments: assignments.count ?? 0,
    courses: courses.count ?? 0,
  };
}

/** Published assignment ids for the sitemap. Bounded so the query stays cheap. */
export async function listPublishedForSitemap(
  limit = 500,
): Promise<{ id: string; updated_at: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("id, updated_at")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataAccessError("Could not build the sitemap", error.code);
  }

  return data ?? [];
}

export async function getOrCreateCourse(
  name: string,
  code?: string | null,
  department?: string | null,
): Promise<CourseOption> {
  const supabase = await createSupabaseServerClient();
  // A function returning a composite row (not SETOF) already yields a single
  // object, so `.single()` would narrow the result to `never` in postgrest-js.
  const { data, error } = await supabase.rpc("create_or_get_course", {
    p_name: name,
    p_code: code ?? null,
    p_department: department ?? null,
  });

  if (error || !data) {
    throw new DataAccessError("Could not save the course", error?.code);
  }

  return { id: data.id, name: data.name, code: data.code };
}

export async function insertAssignment(
  userId: string,
  input: AssignmentCreateInput,
  courseId: string,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      title: input.title,
      description: input.description,
      course_id: courseId,
      user_id: userId,
      lecturer_name: input.lecturerName ?? null,
      semester: input.semester ?? null,
      academic_year: input.academicYear ?? null,
      assignment_type: input.assignmentType ?? null,
      deadline: input.deadline ?? null,
      tags: input.tags,
      reference_urls: input.referenceUrls,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new DataAccessError("Could not create the assignment", error?.code);
  }

  return data.id;
}

export async function updateAssignmentRecord(
  userId: string,
  id: string,
  input: AssignmentUpdateInput,
  courseId: string | null,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const patch: Database["public"]["Tables"]["assignments"]["Update"] = {};

  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (courseId !== null) patch.course_id = courseId;
  if (input.lecturerName !== undefined)
    patch.lecturer_name = input.lecturerName;
  if (input.semester !== undefined) patch.semester = input.semester;
  if (input.academicYear !== undefined)
    patch.academic_year = input.academicYear;
  if (input.assignmentType !== undefined)
    patch.assignment_type = input.assignmentType;
  if (input.deadline !== undefined) patch.deadline = input.deadline;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.referenceUrls !== undefined)
    patch.reference_urls = input.referenceUrls;

  if (Object.keys(patch).length === 0) {
    return true;
  }

  const { data, error } = await supabase
    .from("assignments")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not update the assignment", error.code);
  }

  return data !== null;
}

export async function deleteAssignmentRecord(
  userId: string,
  id: string,
): Promise<{ deleted: boolean; storagePaths: string[] }> {
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: readError } = await supabase
    .from("assignments")
    .select("id, assignment_attachments ( storage_path )")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    throw new DataAccessError("Could not load the assignment", readError.code);
  }

  if (!existing) {
    return { deleted: false, storagePaths: [] };
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("assignments")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    throw new DataAccessError(
      "Could not delete the assignment",
      deleteError.code,
    );
  }

  if (!deleted) {
    return { deleted: false, storagePaths: [] };
  }

  return {
    deleted: true,
    storagePaths: existing.assignment_attachments.map(
      (row) => row.storage_path,
    ),
  };
}

export async function insertAttachmentRecords(
  assignmentId: string,
  attachments: {
    storagePath: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
  }[],
): Promise<void> {
  if (attachments.length === 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("assignment_attachments").insert(
    attachments.map((attachment) => ({
      assignment_id: assignmentId,
      storage_path: attachment.storagePath,
      original_filename: attachment.originalFilename,
      mime_type: attachment.mimeType,
      file_size: attachment.fileSize,
    })),
  );

  if (error) {
    throw new DataAccessError("Could not save attachment records", error.code);
  }
}

function toAssignmentDetail(
  record: AssignmentRecord,
  profile: { display_name: string; avatar_url: string | null } | null,
): AssignmentDetail {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    course_id: record.course_id,
    course_name: record.courses?.name ?? "Unknown course",
    course_code: record.courses?.code ?? null,
    course_department: record.courses?.department ?? null,
    user_id: record.user_id,
    lecturer_name: record.lecturer_name,
    semester: record.semester,
    academic_year: record.academic_year,
    assignment_type: record.assignment_type,
    deadline: record.deadline,
    tags: record.tags,
    reference_urls: parseReferenceUrls(record.reference_urls),
    status: record.status,
    created_at: record.created_at,
    updated_at: record.updated_at,
    author_display_name: profile?.display_name ?? "StarsTask member",
    author_avatar_url: profile?.avatar_url ?? null,
    attachments: record.assignment_attachments,
  };
}

function parseReferenceUrls(value: Json): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

import "server-only";

import { cache } from "react";

import type {
  AssignmentCreateInput,
  AssignmentUpdateInput,
  ListAssignmentsQuery,
  MyAssignmentsQuery,
} from "@starstask/contracts";

import type { AssignmentStatusRow, Database, Json } from "@/types/database";
import { LISTING_CACHE_TTL_SECONDS, getCached } from "@/lib/cache/redis-cache";
import { decodeCursor, encodeCursor } from "@/lib/db/cursor";
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
  content_type: string;
  source_label: string | null;
  drive_url: string | null;
  deadline: string | null;
  tags: string[];
  reference_urls: string[];
  status: AssignmentStatusRow;
  class_id: string | null;
  rejection_reason: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author_display_name: string;
  author_avatar_url: string | null;
  attachments: AssignmentAttachment[];
};

export type MyAssignment = {
  id: string;
  title: string;
  status: AssignmentStatusRow;
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

export type MemberCourseOption = CourseOption & {
  department: string | null;
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
  content_type: string;
  source_label: string | null;
  drive_url: string | null;
  deadline: string | null;
  tags: string[];
  reference_urls: Json;
  status: AssignmentStatusRow;
  class_id: string | null;
  rejection_reason: string | null;
  published_at: string | null;
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
  content_type,
  source_label,
  drive_url,
  deadline,
  tags,
  reference_urls,
  status,
  class_id,
  rejection_reason,
  published_at,
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
  const args: Database["public"]["Functions"]["list_assignments"]["Args"] = {
    p_search: query.search ?? null,
    p_course_id: query.course ?? null,
    p_semester: query.semester ?? null,
    p_type: query.type ?? null,
    p_tag: query.tag ?? null,
    p_sort: query.sort,
    p_limit: query.pageSize,
    p_offset: offset,
  };

  // Send the class filter only when it is used. An older database without the
  // class migration still serves the public listing, while a class page fails
  // loudly instead of silently listing unrelated assignments.
  if (query.class) {
    args.p_class_id = query.class;
  }

  const { data, error } = await supabase.rpc("list_assignments", args);

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

/**
 * Cached for the lifetime of one render so `generateMetadata` and the page
 * share the same read instead of fetching the assignment twice.
 */
export const getAssignmentDetail = cache(
  async (id: string): Promise<AssignmentDetail | null> => {
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
  },
);

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

export type MyAssignmentPage = PaginatedResult<MyAssignment> & {
  nextCursor: string | null;
  hasMore: boolean;
};

export async function getMyAssignments(
  userId: string,
  query: MyAssignmentsQuery,
): Promise<MyAssignmentPage> {
  const supabase = await createSupabaseServerClient();
  const offset = (query.page - 1) * query.pageSize;
  const cursorTs = decodeCursor(query.cursor);
  const useCursor = query.cursor !== undefined;

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

  if (useCursor && cursorTs) {
    request = request.lt("created_at", cursorTs);
  }

  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .range(
      useCursor ? 0 : offset,
      useCursor ? query.pageSize : offset + query.pageSize - 1,
    );

  if (error) {
    throw new DataAccessError("Could not load your assignments", error.code);
  }

  const rawRows = data ?? [];
  const hasMore = useCursor && rawRows.length > query.pageSize;
  const pageRows = hasMore ? rawRows.slice(0, query.pageSize) : rawRows;

  const items = pageRows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status as AssignmentStatusRow,
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
    nextCursor:
      hasMore && pageRows.length > 0
        ? encodeCursor(pageRows[pageRows.length - 1]?.created_at ?? "")
        : null,
    hasMore,
  };
}

export type OwnedAssignmentTemplate = {
  id: string;
  title: string;
  description: string;
  courseName: string;
  courseCode: string | null;
  department: string | null;
  lecturerName: string | null;
  assignmentType: string | null;
  tags: string[];
  referenceUrls: string[];
};

type OwnedTemplateRecord = {
  id: string;
  title: string;
  description: string;
  lecturer_name: string | null;
  assignment_type: string | null;
  tags: string[];
  reference_urls: Json;
  courses: {
    name: string;
    code: string | null;
    department: string | null;
  } | null;
};

/**
 * Loads the caller's own recent assignments for the starter kit.
 *
 * Only rows the caller owns are read, so the picker never exposes another
 * student's brief.
 */
export async function listOwnedAssignmentTemplates(
  userId: string,
  limit = 5,
): Promise<OwnedAssignmentTemplate[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      "id, title, description, lecturer_name, assignment_type, tags, reference_urls, courses!assignments_course_id_fkey ( name, code, department )",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<OwnedTemplateRecord[]>();

  if (error) {
    throw new DataAccessError(
      "Could not load your previous assignments",
      error.code,
    );
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    courseName: row.courses?.name ?? "Unknown course",
    courseCode: row.courses?.code ?? null,
    department: row.courses?.department ?? null,
    lecturerName: row.lecturer_name,
    assignmentType: row.assignment_type,
    tags: row.tags,
    referenceUrls: parseReferenceUrls(row.reference_urls),
  }));
}

/** Courses of the classes the user belongs to; see `getMemberCourseOptions`. */
const MEMBER_CLASS_LIMIT = 200;

/**
 * Courses a member may pick when contributing an assignment.
 *
 * Courses live inside the class (`class_subjects`), so the picker offers those
 * records instead of free text: a typed name would fork one course into several
 * spellings and detach the submission from the class it came from.
 */
export async function getMemberCourseOptions(
  userId: string,
): Promise<MemberCourseOption[]> {
  const supabase = await createSupabaseServerClient();

  const { data: memberships, error: membershipError } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", userId)
    .limit(MEMBER_CLASS_LIMIT);

  if (membershipError) {
    throw new DataAccessError(
      "Could not load your classes",
      membershipError.code,
    );
  }

  const classIds = (memberships ?? []).map((row) => row.class_id);

  if (classIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("class_subjects")
    .select(
      "id, name, code, courses!class_subjects_course_id_fkey ( department )",
    )
    .in("class_id", classIds)
    .eq("status", "active");

  if (error) {
    throw new DataAccessError("Could not load your courses", error.code);
  }

  const seenNames = new Set<string>();
  const options: MemberCourseOption[] = [];

  for (const subject of data ?? []) {
    // Two classes can offer the same course; the picker shows it once.
    const key = subject.name.trim().toLowerCase();

    if (seenNames.has(key)) {
      continue;
    }

    seenNames.add(key);
    options.push({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      department: subject.courses?.department ?? null,
    });
  }

  return options.sort((left, right) => left.name.localeCompare(right.name));
}

export async function getSemesterOptions(): Promise<string[]> {
  return getCached("semesters", LISTING_CACHE_TTL_SECONDS, async () => {
    const supabase = await createSupabaseServerClient();

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "list_published_semesters" as never,
    );

    if (!rpcError && rpcData) {
      return (rpcData as unknown as { semester: string }[])
        .map((row) => row.semester)
        .sort((a, b) => a.localeCompare(b));
    }

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
  });
}

export async function getPublishedCounts(): Promise<{
  assignments: number;
  courses: number;
}> {
  return getCached("published-counts", LISTING_CACHE_TTL_SECONDS, async () => {
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
  });
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

/**
 * Whether this author's public submission publishes straight away or queues for
 * review. Wraps the same predicate the insert policy enforces, so the app never
 * claims a status the database would refuse.
 */
export async function canPublishPublicAssignment(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "can_publish_public_assignment",
    {},
  );

  if (error) {
    throw new DataAccessError("Could not resolve permissions", error.code);
  }

  return data === true;
}

export async function insertAssignment(
  userId: string,
  input: AssignmentCreateInput,
  courseId: string,
  forceDraft = false,
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
      // Draft fallback: kalau file out/nggak allowed atau publish gagal,
      // simpan sebagai draft biar user tidak kehilangan data.
      // A member's submission is a request a platform admin reviews before
      // `list_assignments` returns it. Anyone who administers a class already
      // publishes to that class, so their public brief goes live at once.
      status: forceDraft
        ? "draft"
        : (await canPublishPublicAssignment())
          ? "published"
          : "pending",
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

  const { data: existing, error: readError } = await supabase
    .from("assignments")
    .select("id, status, class_id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    throw new DataAccessError("Could not load the assignment", readError.code);
  }

  if (!existing) {
    return false;
  }

  // Editing a rejected public request sends it back for review; the previous
  // rejection note no longer matches the updated content.
  if (existing.status === "rejected" && existing.class_id === null) {
    patch.status = "pending";
    patch.rejection_reason = null;
    patch.reviewed_by = null;
    patch.reviewed_at = null;
  }

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
): Promise<AttachmentRecordSummary[]> {
  if (attachments.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignment_attachments")
    .insert(
      attachments.map((attachment) => ({
        assignment_id: assignmentId,
        storage_path: attachment.storagePath,
        original_filename: attachment.originalFilename,
        mime_type: attachment.mimeType,
        file_size: attachment.fileSize,
      })),
    )
    .select("id, original_filename, mime_type, file_size");

  if (error) {
    throw new DataAccessError("Could not save attachment records", error.code);
  }

  return data ?? [];
}

export type AttachmentRecordSummary = {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
};

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
    content_type: record.content_type,
    source_label: record.source_label,
    drive_url: record.drive_url,
    deadline: record.deadline,
    tags: record.tags,
    reference_urls: parseReferenceUrls(record.reference_urls),
    status: record.status,
    class_id: record.class_id,
    rejection_reason: record.rejection_reason,
    published_at: record.published_at,
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

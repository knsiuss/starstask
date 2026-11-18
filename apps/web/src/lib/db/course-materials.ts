import "server-only";

import type {
  CourseMaterialCreateInput,
  CourseMaterialFormat,
  CourseMaterialKind,
  CourseMaterialUpdateInput,
  CourseMaterialView,
} from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { createCourseMediaSignedUrls } from "@/lib/storage/course-media";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const COURSE_MATERIAL_COLUMNS =
  "id, class_id, subject_id, meeting_number, content_format, kind, title, description, resource_url, file_path, file_name, file_mime, file_size, created_at, updated_at";

/**
 * Learning materials of one course, enriched with short-lived signed URLs.
 */
function assertValidCourseMaterialPath(
  classId: string,
  subjectId: string,
  filePath: string | null | undefined,
): string | null {
  if (!filePath) {
    return null;
  }

  const trimmed = filePath.trim();
  const expectedPrefix = `${classId}/${subjectId}/materials/`;

  if (
    !trimmed.startsWith(expectedPrefix) ||
    trimmed.includes("..") ||
    trimmed.includes("\\")
  ) {
    throw new DataAccessError("Invalid material file path", "22023");
  }

  return trimmed;
}

export async function listCourseMaterials(
  classId: string,
  subjectId: string,
): Promise<CourseMaterialView[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("course_materials")
    .select(COURSE_MATERIAL_COLUMNS)
    .eq("class_id", classId)
    .eq("subject_id", subjectId)
    .order("meeting_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new DataAccessError("Could not load course materials", error.code);
  }

  const rows = data ?? [];
  const prefix = `${classId}/`;
  const signedUrls = await createCourseMediaSignedUrls(
    rows
      .map((row) => row.file_path)
      .filter(
        (path): path is string =>
          typeof path === "string" &&
          path.startsWith(prefix) &&
          !path.includes(".."),
      ),
  );

  return rows.map((row) => ({
    id: row.id,
    class_id: row.class_id,
    subject_id: row.subject_id,
    meeting_number: row.meeting_number ?? null,
    content_format: (row.content_format ?? "markdown") as CourseMaterialFormat,
    kind: row.kind as CourseMaterialKind,
    title: row.title,
    description: row.description,
    resource_url: row.resource_url,
    file_path: row.file_path ?? null,
    file_name: row.file_name ?? null,
    file_mime: row.file_mime ?? null,
    file_size: row.file_size ?? null,
    signed_url: row.file_path ? (signedUrls.get(row.file_path) ?? null) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function createCourseMaterial(params: {
  classId: string;
  subjectId: string;
  userId: string;
  input: CourseMaterialCreateInput;
}): Promise<string> {
  const safeFilePath = assertValidCourseMaterialPath(
    params.classId,
    params.subjectId,
    params.input.filePath,
  );
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("course_materials")
    .insert({
      class_id: params.classId,
      subject_id: params.subjectId,
      meeting_number: params.input.meetingNumber ?? null,
      content_format: params.input.contentFormat ?? "markdown",
      kind: params.input.kind,
      title: params.input.title,
      description: params.input.description ?? null,
      resource_url: params.input.resourceUrl ?? null,
      file_path: safeFilePath,
      file_name: params.input.fileName ?? null,
      file_mime: params.input.fileMime ?? null,
      file_size: params.input.fileSize ?? null,
      created_by: params.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new DataAccessError("Could not save the material", error?.code);
  }

  return data.id;
}

export async function updateCourseMaterial(params: {
  classId: string;
  materialId: string;
  input: CourseMaterialUpdateInput;
}): Promise<void> {
  const safeFilePath = assertValidCourseMaterialPath(
    params.classId,
    params.input.subjectId,
    params.input.filePath,
  );
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("course_materials")
    .update({
      subject_id: params.input.subjectId,
      meeting_number: params.input.meetingNumber ?? null,
      content_format: params.input.contentFormat ?? "markdown",
      kind: params.input.kind,
      title: params.input.title,
      description: params.input.description ?? null,
      resource_url: params.input.resourceUrl ?? null,
      file_path: safeFilePath,
      file_name: params.input.fileName ?? null,
      file_mime: params.input.fileMime ?? null,
      file_size: params.input.fileSize ?? null,
    })
    .eq("id", params.materialId)
    .eq("class_id", params.classId)
    .select("id");

  if (error) {
    throw new DataAccessError("Could not update the material", error.code);
  }

  if (!data || data.length === 0) {
    throw new DataAccessError("Material not found", "P0002");
  }
}

export async function deleteCourseMaterial(params: {
  classId: string;
  materialId: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("course_materials")
    .delete()
    .eq("id", params.materialId)
    .eq("class_id", params.classId);

  if (error) {
    throw new DataAccessError("Could not delete the material", error.code);
  }
}

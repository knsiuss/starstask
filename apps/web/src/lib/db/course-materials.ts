import "server-only";

import type {
  CourseMaterialCreateInput,
  CourseMaterialKind,
  CourseMaterialUpdateInput,
  CourseMaterialView,
} from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const COURSE_MATERIAL_COLUMNS =
  "id, class_id, subject_id, kind, title, description, resource_url, created_at, updated_at";

/**
 * Learning materials of one course.
 *
 * RLS limits reads to class members, and the extra class/subject filter keeps a
 * course page from showing a material that belongs to a sibling course.
 */
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
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new DataAccessError("Could not load course materials", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    class_id: row.class_id,
    subject_id: row.subject_id,
    kind: row.kind as CourseMaterialKind,
    title: row.title,
    description: row.description,
    resource_url: row.resource_url,
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
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("course_materials")
    .insert({
      class_id: params.classId,
      subject_id: params.subjectId,
      kind: params.input.kind,
      title: params.input.title,
      description: params.input.description ?? null,
      resource_url: params.input.resourceUrl ?? null,
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
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("course_materials")
    .update({
      subject_id: params.input.subjectId,
      kind: params.input.kind,
      title: params.input.title,
      description: params.input.description ?? null,
      resource_url: params.input.resourceUrl ?? null,
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

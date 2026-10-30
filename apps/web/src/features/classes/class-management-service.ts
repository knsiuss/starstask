import "server-only";

import type {
  ClassAdminAssignInput,
  ClassMetadataUpdateInput,
  ClassStatusUpdateInput,
} from "@starstask/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toClassApiError } from "@/features/classes/errors";

export async function updateClassMetadata(
  classId: string,
  input: ClassMetadataUpdateInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("update_class_metadata", {
    p_class_id: classId,
    p_name: input.name,
    p_description: input.description,
    p_course_name: input.courseName,
    p_semester: input.semester,
    p_academic_year: input.academicYear,
    p_institution: input.institution ?? null,
    p_lecturer_name: input.lecturerName ?? null,
  });

  if (error) {
    throw toClassApiError(error, "Could not update the class.");
  }
}

export async function setClassStatus(
  classId: string,
  input: ClassStatusUpdateInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("set_class_status", {
    p_class_id: classId,
    p_status: input.status,
  });

  if (error) {
    throw toClassApiError(error, "Could not change the class status.");
  }
}

/**
 * Deletes a class and everything that belongs to it.
 *
 * `delete_class` archives the class's published assignments first, because the
 * foreign key only nulls their `class_id`; leaving them published would keep the
 * content public with no class to moderate it.
 */
export async function deleteClass(classId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("delete_class", {
    p_class_id: classId,
  });

  if (error) {
    throw toClassApiError(error, "Could not delete the class.");
  }
}

export async function assignClassAdmin(
  classId: string,
  input: ClassAdminAssignInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("assign_class_admin", {
    p_class_id: classId,
    p_user_id: input.userId,
  });

  if (error) {
    throw toClassApiError(error, "Could not assign the class admin.");
  }
}

export async function revokeClassAdmin(
  classId: string,
  userId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("revoke_class_admin", {
    p_class_id: classId,
    p_user_id: userId,
  });

  if (error) {
    throw toClassApiError(error, "Could not revoke the class admin.");
  }
}

export async function removeClassMember(
  classId: string,
  userId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("remove_class_member", {
    p_class_id: classId,
    p_user_id: userId,
  });

  if (error) {
    throw toClassApiError(error, "Could not remove the member.");
  }
}

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
    p_class_code: input.classCode ?? null,
  });

  if (error) {
    throw toClassApiError(error, "Could not update the class.");
  }

  if (input.joinPolicy) {
    const { error: policyError } = await supabase.rpc("set_class_join_policy", {
      p_class_id: classId,
      p_policy: input.joinPolicy,
    });

    if (policyError) {
      throw toClassApiError(
        policyError,
        "Could not change how students join the class.",
      );
    }
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
 * Permanently deletes a class only when it has no academic history.
 *
 * The database function counts members, assignments, submissions, sessions,
 * attendance, schedules, leave requests, subjects, and invitations. Anything
 * beyond a draft or an empty class makes the call fail, so the caller must
 * archive instead of erasing student records.
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

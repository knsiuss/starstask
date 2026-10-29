import "server-only";

import type {
  ClassApplicationCreateInput,
  ClassApplicationDecisionInput,
  ClassApplicationReviseInput,
} from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toClassApiError } from "@/features/classes/errors";

export type ClassApplicationResult = { id: string };

/**
 * Submits a class creation application for the verified session user.
 *
 * The applicant id is never taken from the request body: `apply_for_class`
 * reads `auth.uid()` inside the database, so a client cannot apply on behalf of
 * somebody else.
 */
export async function submitClassApplication(
  input: ClassApplicationCreateInput,
): Promise<ClassApplicationResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("apply_for_class", {
    p_proposed_slug: input.proposedSlug,
    p_proposed_name: input.proposedName,
    p_course_name: input.courseName,
    p_semester: input.semester,
    p_academic_year: input.academicYear,
    p_description: input.description,
    p_reason: input.reason,
    p_institution: input.institution ?? null,
    p_lecturer_name: input.lecturerName ?? null,
    p_supporting_info: input.supportingInfo ?? null,
  });

  if (error || !data) {
    throw toClassApiError(error, "Could not submit the application.");
  }

  return { id: data };
}

export async function reviseClassApplication(
  applicationId: string,
  input: ClassApplicationReviseInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("revise_class_application", {
    p_application_id: applicationId,
    p_proposed_slug: input.proposedSlug,
    p_proposed_name: input.proposedName,
    p_course_name: input.courseName,
    p_semester: input.semester,
    p_academic_year: input.academicYear,
    p_description: input.description,
    p_reason: input.reason,
    p_institution: input.institution ?? null,
    p_lecturer_name: input.lecturerName ?? null,
    p_supporting_info: input.supportingInfo ?? null,
  });

  if (error) {
    throw toClassApiError(error, "Could not update the application.");
  }
}

export async function withdrawClassApplication(
  applicationId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("withdraw_class_application", {
    p_application_id: applicationId,
  });

  if (error) {
    throw toClassApiError(error, "Could not withdraw the application.");
  }
}

/**
 * Records a platform decision. `is_platform_admin()` is checked inside the
 * function, so calling this route without the role fails at the database even
 * if the HTTP layer were bypassed.
 */
export async function decideClassApplication(
  applicationId: string,
  input: ClassApplicationDecisionInput,
): Promise<{ classId: string | null }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("decide_class_application", {
    p_application_id: applicationId,
    p_decision: input.decision,
    p_note: input.note ?? null,
    p_grant_class_admin: input.grantClassAdmin,
  });

  if (error) {
    throw toClassApiError(error, "Could not record the decision.");
  }

  if (input.decision === "approved" && !data) {
    throw new ApiError(500, "internal_error", "The class was not created.");
  }

  return { classId: data ?? null };
}

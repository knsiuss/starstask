import "server-only";

import type { PublicAssignmentReviewInput } from "@starstask/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toClassApiError } from "@/features/classes/errors";

/**
 * Publishes or rejects a class-less assignment request.
 *
 * Permission, state validation, review history, audit, and the submitter
 * notification all happen inside `review_public_assignment`, in one
 * transaction.
 */
export async function reviewPublicAssignment(
  assignmentId: string,
  input: PublicAssignmentReviewInput,
): Promise<{ status: string }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("review_public_assignment", {
    p_assignment_id: assignmentId,
    p_decision: input.decision,
    p_reason: input.reason ?? null,
  });

  if (error || !data) {
    throw toClassApiError(error, "Could not record the review.");
  }

  return { status: data };
}

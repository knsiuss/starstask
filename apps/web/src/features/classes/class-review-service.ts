import "server-only";

import type {
  AssignmentModerationInput,
  AssignmentReviewInput,
} from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import {
  createSupabaseAdminClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ATTACHMENT_BUCKET } from "@/lib/storage/attachments";
import { toClassApiError } from "@/features/classes/errors";

/**
 * Approves or rejects a submission.
 *
 * The decision is written by `review_class_assignment` in one transaction:
 * permission check, self-review check, status change, review history, audit
 * entry, and the submitter notification all happen together or not at all.
 */
export async function reviewSubmission(
  assignmentId: string,
  input: AssignmentReviewInput,
): Promise<{ status: string }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("review_class_assignment", {
    p_assignment_id: assignmentId,
    p_decision: input.decision,
    p_reason: input.reason ?? null,
  });

  if (error || !data) {
    throw toClassApiError(error, "Could not record the review.");
  }

  return { status: data };
}

export async function moderateAssignment(
  assignmentId: string,
  input: AssignmentModerationInput,
): Promise<{ status: string }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("moderate_assignment", {
    p_assignment_id: assignmentId,
    p_action: input.action,
    p_reason: input.reason ?? null,
  });

  if (error || !data) {
    throw toClassApiError(error, "Could not apply the moderation action.");
  }

  return { status: data };
}

/**
 * Removes an attachment row and then its storage object.
 *
 * The row is deleted first so the file becomes unreachable even if the object
 * delete has to be retried. The object lives under the submitter's prefix, so
 * only the service role can delete it on a moderator's behalf.
 */
export async function removeSensitiveAttachment(
  attachmentId: string,
  reason: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data: storagePath, error } = await supabase.rpc(
    "remove_assignment_attachment",
    { p_attachment_id: attachmentId, p_reason: reason },
  );

  if (error || !storagePath) {
    throw toClassApiError(error, "Could not remove the attachment.");
  }

  if (!isServiceRoleConfigured()) {
    throw new ApiError(
      503,
      "storage_unavailable",
      "Attachment cleanup is not configured on this deployment.",
    );
  }

  const admin = createSupabaseAdminClient();
  const { error: storageError } = await admin.storage
    .from(ATTACHMENT_BUCKET)
    .remove([storagePath]);

  if (storageError) {
    // The row is already gone, so the file is unreachable through the app.
    // Log the code only; the path may identify a user.
    console.error("[storage] orphaned attachment object", {
      code: storageError.name,
    });
  }
}

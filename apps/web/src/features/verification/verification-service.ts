import "server-only";

import type {
  DeclaredPosition,
  VerificationDecisionInput,
  VerificationRequestCreateInput,
  VerificationRequestReviseInput,
  VerificationRevokeInput,
} from "@starstask/contracts";

import { ApiError, forbidden, notFound } from "@/lib/api/errors";
import {
  getVerificationRequestById,
  type VerificationRequestView,
} from "@/lib/db/verification";
import { VERIFICATION_EVIDENCE_BUCKET } from "@/lib/storage/verification-evidence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requirePlatformAdmin,
  requireSession,
} from "@/features/classes/class-access";
import { toClassApiError } from "@/features/classes/errors";

/** Records the student's own claim. It never touches class membership. */
export async function updateDeclaredPosition(
  position: DeclaredPosition,
): Promise<DeclaredPosition> {
  await requireSession();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_my_declared_position", {
    p_position: position,
  });

  if (error || !data) {
    throw toClassApiError(error, "Could not save your position.");
  }

  return data === "class_representative" ? "class_representative" : "student";
}

/** Loads the request and asserts the caller owns an editable one. */
async function requireEditableOwnRequest(
  requestId: string,
): Promise<VerificationRequestView> {
  const session = await requireSession();
  const request = await getVerificationRequestById(requestId);

  if (!request) {
    throw notFound();
  }

  if (request.studentId !== session.user.id) {
    throw forbidden();
  }

  const editable =
    request.status === "needs_revision" ||
    (request.status === "pending" && request.submittedAt === null);

  if (!editable) {
    throw new ApiError(
      409,
      "not_editable",
      "This verification request can no longer be edited.",
    );
  }

  return request;
}

/**
 * Creates a draft or resumes the existing one.
 *
 * When a draft is resumed with a different explanation, the latest text is
 * saved so the student does not have to retype it.
 */
export async function beginVerification(
  input: VerificationRequestCreateInput,
): Promise<{ requestId: string }> {
  await requireSession();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("begin_class_verification", {
    p_class_id: input.classId,
    p_statement: input.statement,
  });

  if (error || !data) {
    throw toClassApiError(error, "Could not start the verification request.");
  }

  const request = await getVerificationRequestById(data);

  if (request && request.statement !== input.statement) {
    const { error: reviseError } = await supabase.rpc(
      "revise_class_verification",
      {
        p_request_id: data,
        p_statement: input.statement,
      },
    );

    if (reviseError) {
      throw toClassApiError(
        reviseError,
        "Could not save the verification explanation.",
      );
    }
  }

  return { requestId: data };
}

/**
 * Grants class representative access (a class_admins row) directly.
 *
 * Temporary path while verification review is disabled. The RPC re-checks
 * membership, class status, and the 5-representatives-per-class cap; this
 * wrapper only translates its outcome codes into API errors.
 */
export async function becomeClassRepresentative(
  classId: string,
): Promise<{ granted: boolean; alreadyRepresentative: boolean }> {
  await requireSession();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("become_class_representative", {
    p_class_id: classId,
  });

  if (error) {
    throw toClassApiError(error, "Could not make you a class representative.");
  }

  switch (data) {
    case "granted":
      return { granted: true, alreadyRepresentative: false };
    case "already_representative":
      return { granted: false, alreadyRepresentative: true };
    case "limit_reached":
      throw new ApiError(
        409,
        "representative_limit",
        "This class already has 5 class representatives.",
      );
    case "not_member":
      throw new ApiError(
        403,
        "not_member",
        "Join the class before becoming its representative.",
      );
    case "class_inactive":
      throw new ApiError(
        409,
        "class_inactive",
        "This class is no longer active.",
      );
    default:
      throw notFound();
  }
}

export async function reviseVerification(
  requestId: string,
  input: VerificationRequestReviseInput,
): Promise<void> {
  await requireEditableOwnRequest(requestId);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("revise_class_verification", {
    p_request_id: requestId,
    p_statement: input.statement,
  });

  if (error) {
    throw toClassApiError(error, "Could not save the explanation.");
  }
}

/**
 * Submits for review.
 *
 * Repeating a submit for an already submitted request is a no-op, so a double
 * click cannot create a second review round or a duplicate notification.
 */
export async function submitVerification(requestId: string): Promise<void> {
  const session = await requireSession();
  const request = await getVerificationRequestById(requestId);

  if (!request) {
    throw notFound();
  }

  if (request.studentId !== session.user.id) {
    throw forbidden();
  }

  if (request.status === "pending" && request.submittedAt !== null) {
    return;
  }

  const editable =
    request.status === "needs_revision" ||
    (request.status === "pending" && request.submittedAt === null);

  if (!editable) {
    throw new ApiError(
      409,
      "not_submittable",
      "This verification request can no longer be submitted.",
    );
  }

  if (request.evidenceCount === 0) {
    throw new ApiError(
      400,
      "evidence_required",
      "Attach at least one document before submitting.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_class_verification", {
    p_request_id: requestId,
  });

  if (error) {
    throw toClassApiError(error, "Could not submit the verification request.");
  }
}

/** Deletes an unfinished draft and cleans up its objects. */
export async function discardVerification(requestId: string): Promise<void> {
  const session = await requireSession();
  const request = await getVerificationRequestById(requestId);

  if (!request) {
    throw notFound();
  }

  if (request.studentId !== session.user.id) {
    throw forbidden();
  }

  if (request.submittedAt !== null || request.status !== "pending") {
    throw new ApiError(
      409,
      "not_discardable",
      "A submitted request cannot be discarded.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("discard_class_verification", {
    p_request_id: requestId,
  });

  if (error) {
    throw toClassApiError(error, "Could not discard the verification request.");
  }

  const paths = data ?? [];

  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(VERIFICATION_EVIDENCE_BUCKET)
      .remove(paths);

    if (removeError) {
      console.warn("[verification] draft cleanup failed", {
        code: removeError.name,
      });
    }
  }
}

/**
 * Records a platform admin decision.
 *
 * The database re-checks the platform admin role, blocks self-review, and only
 * creates the class admin assignment for an approval. This wrapper adds no
 * authority of its own.
 */
export async function decideVerification(
  requestId: string,
  input: VerificationDecisionInput,
): Promise<string> {
  await requirePlatformAdmin();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("decide_class_verification", {
    p_request_id: requestId,
    p_decision: input.decision,
    p_note: input.note,
  });

  if (error || !data) {
    throw toClassApiError(error, "Could not record the decision.");
  }

  return data;
}

/** Removes the class admin access an approved verification granted. */
export async function revokeVerificationAccess(
  requestId: string,
  input: VerificationRevokeInput,
): Promise<void> {
  await requirePlatformAdmin();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("revoke_verified_class_admin", {
    p_request_id: requestId,
    p_note: input.note,
  });

  if (error) {
    throw toClassApiError(error, "Could not revoke class admin access.");
  }
}

import "server-only";

import { VERIFICATION_EVIDENCE_MAX_FILES } from "@starstask/contracts";

import { ApiError, forbidden, notFound } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import {
  getVerificationRequestById,
  listVerificationEvidence,
} from "@/lib/db/verification";
import {
  buildVerificationStoragePath,
  validateVerificationEvidenceFile,
  VERIFICATION_EVIDENCE_BUCKET,
  VERIFICATION_SIGNED_URL_TTL_SECONDS,
} from "@/lib/storage/verification-evidence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toClassApiError } from "@/features/classes/errors";

export type VerificationEvidenceDownload = {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  /** Short-lived signed URL, or null when it could not be created. */
  signedUrl: string | null;
};

/**
 * Rejects an upload early with a clear message.
 *
 * The database function repeats every one of these checks; this version exists
 * so the student sees a useful error instead of a generic SQLSTATE mapping.
 */
async function requireEditableOwnRequest(requestId: string) {
  const session = await getSessionUser();

  if (!session) {
    throw new ApiError(401, "unauthorized", "Sign in to continue.");
  }

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

  return { session, request };
}

/**
 * Stores one proof file and registers it against the request.
 *
 * The object is uploaded first, then the row. If the row fails, the object is
 * deleted again so a rejected upload cannot leave an orphan in the bucket.
 */
export async function uploadVerificationEvidence(
  requestId: string,
  file: File,
): Promise<{ evidenceId: string; originalFilename: string }> {
  const { session } = await requireEditableOwnRequest(requestId);

  const existing = await listVerificationEvidence(requestId);

  if (existing.length >= VERIFICATION_EVIDENCE_MAX_FILES) {
    throw new ApiError(
      400,
      "too_many_files",
      `You can attach at most ${VERIFICATION_EVIDENCE_MAX_FILES} files.`,
    );
  }

  const validation = await validateVerificationEvidenceFile(file);

  if (!validation.ok) {
    throw new ApiError(400, "invalid_file", validation.error);
  }

  const validated = validation.value;
  const storagePath = buildVerificationStoragePath(
    session.user.id,
    requestId,
    validated.objectName,
  );

  const supabase = await createSupabaseServerClient();
  const { error: uploadError } = await supabase.storage
    .from(VERIFICATION_EVIDENCE_BUCKET)
    .upload(storagePath, validated.bytes, {
      contentType: validated.mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("[verification] evidence upload failed", {
      code: uploadError.name,
    });

    throw new ApiError(
      500,
      "upload_failed",
      "Could not store the file. Try again.",
    );
  }

  const { data, error } = await supabase.rpc(
    "add_class_verification_evidence",
    {
      p_request_id: requestId,
      p_storage_path: storagePath,
      p_original_filename: validated.originalFilename,
      p_mime_type: validated.mimeType,
      p_file_size: validated.fileSize,
    },
  );

  if (error || !data) {
    const { error: cleanupError } = await supabase.storage
      .from(VERIFICATION_EVIDENCE_BUCKET)
      .remove([storagePath]);

    if (cleanupError) {
      console.error("[verification] evidence cleanup failed", {
        code: cleanupError.name,
        requestId,
      });
    }

    throw toClassApiError(error, "Could not attach the file.");
  }

  return { evidenceId: data, originalFilename: validated.originalFilename };
}

/** Soft-deletes the row, then removes the object. */
export async function removeVerificationEvidence(
  evidenceId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: storagePath, error } = await supabase.rpc(
    "remove_class_verification_evidence",
    { p_evidence_id: evidenceId },
  );

  if (error) {
    throw toClassApiError(error, "Could not remove the file.");
  }

  if (storagePath) {
    const { error: removeError } = await supabase.storage
      .from(VERIFICATION_EVIDENCE_BUCKET)
      .remove([storagePath]);

    if (removeError) {
      // The row is already marked removed, so the file is unreachable through
      // the app either way. Log for cleanup instead of failing the request.
      console.warn("[verification] evidence object cleanup failed", {
        code: removeError.name,
      });
    }
  }
}

/**
 * Signed download URLs for a request's evidence.
 *
 * A URL is only issued when the storage policy lets the caller read the object,
 * so an unauthorized caller gets `null` instead of a link.
 */
export async function getVerificationEvidenceViews(
  requestId: string,
): Promise<VerificationEvidenceDownload[]> {
  const evidence = await listVerificationEvidence(requestId);

  if (evidence.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  return Promise.all(
    evidence.map(async (item) => {
      const { data, error } = await supabase.storage
        .from(VERIFICATION_EVIDENCE_BUCKET)
        .createSignedUrl(
          item.storagePath,
          VERIFICATION_SIGNED_URL_TTL_SECONDS,
          { download: item.originalFilename },
        );

      if (error) {
        console.error("[verification] signed url failed", { code: error.name });
      }

      return {
        id: item.id,
        originalFilename: item.originalFilename,
        mimeType: item.mimeType,
        fileSize: item.fileSize,
        signedUrl: data?.signedUrl ?? null,
      };
    }),
  );
}

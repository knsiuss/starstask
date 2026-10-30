import "server-only";

import { LEAVE_EVIDENCE_MAX_FILES } from "@starstask/contracts";

import { ApiError, forbidden, notFound } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { getLeaveRequestById, listLeaveEvidence } from "@/lib/db/leave";
import { runOcr } from "@/lib/ocr";
import {
  buildEvidenceStoragePath,
  EVIDENCE_SIGNED_URL_TTL_SECONDS,
  LEAVE_EVIDENCE_BUCKET,
  validateEvidenceFile,
} from "@/lib/storage/leave-evidence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { toLeaveApiError } from "@/features/leave/errors";

export type EvidenceView = {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  /** Short-lived signed URL, or null when it could not be created. */
  signedUrl: string | null;
};

/** Rejects the upload early with a clear message instead of a database error. */
async function requireEditableOwnRequest(requestId: string) {
  const session = await getSessionUser();

  if (!session) {
    throw new ApiError(401, "unauthorized", "Sign in to continue.");
  }

  const request = await getLeaveRequestById(requestId);

  if (!request) {
    throw notFound();
  }

  if (request.studentId !== session.user.id) {
    throw forbidden();
  }

  if (request.status !== "draft") {
    throw new ApiError(
      409,
      "not_editable",
      "This request can no longer be edited.",
    );
  }

  return { session, request };
}

/**
 * Stores one evidence file and registers it against the request.
 *
 * Order matters: the object is uploaded first, then the row is created. If the
 * row fails, the object is deleted again so a rejected upload cannot leave an
 * orphan in the bucket. If the cleanup itself fails it is logged rather than
 * thrown, because the database state is already correct.
 */
export async function uploadEvidence(
  requestId: string,
  file: File,
): Promise<{ evidenceId: string; originalFilename: string }> {
  const { session, request } = await requireEditableOwnRequest(requestId);

  const existing = await listLeaveEvidence(requestId);

  if (existing.length >= LEAVE_EVIDENCE_MAX_FILES) {
    throw new ApiError(
      400,
      "too_many_files",
      `You can attach at most ${LEAVE_EVIDENCE_MAX_FILES} files.`,
    );
  }

  const validation = await validateEvidenceFile(file);

  if (!validation.ok) {
    throw new ApiError(400, "invalid_file", validation.error);
  }

  const validated = validation.value;
  const storagePath = buildEvidenceStoragePath(
    session.user.id,
    requestId,
    validated.objectName,
  );

  const supabase = await createSupabaseServerClient();
  const { error: uploadError } = await supabase.storage
    .from(LEAVE_EVIDENCE_BUCKET)
    .upload(storagePath, validated.bytes, {
      contentType: validated.mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("[leave] evidence upload failed", {
      code: uploadError.name,
    });

    throw new ApiError(
      500,
      "upload_failed",
      "Could not store the file. Try again.",
    );
  }

  const { data, error } = await supabase.rpc("add_leave_request_evidence", {
    p_request_id: requestId,
    p_storage_path: storagePath,
    p_original_filename: validated.originalFilename,
    p_mime_type: validated.mimeType,
    p_file_size: validated.fileSize,
  });

  if (error || !data) {
    // Roll the object back so the bucket does not accumulate unreferenced files.
    const { error: cleanupError } = await supabase.storage
      .from(LEAVE_EVIDENCE_BUCKET)
      .remove([storagePath]);

    if (cleanupError) {
      console.error("[leave] evidence cleanup failed", {
        code: cleanupError.name,
        requestId,
      });
    }

    throw toLeaveApiError(error, "Could not attach the file.");
  }

  // Best-effort OCR. A failure here must never fail the upload: manual entry is
  // always available, so the student is never blocked by a reader problem.
  await runEvidenceOcr(data, {
    requestId,
    storagePath,
    mimeType: validated.mimeType,
  });

  return { evidenceId: data, originalFilename: validated.originalFilename };
}

/**
 * Runs the configured OCR provider and records the outcome.
 *
 * The suggestion is stored, never applied: the request columns stay untouched
 * until the student confirms them.
 */
export async function runEvidenceOcr(
  evidenceId: string,
  known?: { requestId: string; storagePath: string; mimeType: string },
): Promise<void> {
  try {
    const target = known ?? (await loadEvidenceTarget(evidenceId));

    if (!target) {
      return;
    }

    const supabase = await createSupabaseServerClient();
    const { data: blob, error } = await supabase.storage
      .from(LEAVE_EVIDENCE_BUCKET)
      .download(target.storagePath);

    if (error || !blob) {
      await recordOcrOutcome(target.requestId, "pdf-text", "failed", null);
      return;
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { outcome, suggestion } = await runOcr({
      bytes,
      mimeType: target.mimeType,
    });

    await recordOcrOutcome(
      target.requestId,
      outcome.provider,
      outcome.status,
      suggestion,
    );
  } catch (error) {
    // Never surface an OCR problem to the caller of an upload.
    console.warn("[leave] ocr skipped", {
      name: error instanceof Error ? error.name : typeof error,
    });
  }
}

async function recordOcrOutcome(
  requestId: string,
  provider: string,
  status: string,
  suggestion: Json | null,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_leave_request_ocr", {
    p_request_id: requestId,
    p_provider: provider,
    p_status: status,
    p_result: suggestion ?? {},
  });

  if (error) {
    console.warn("[leave] could not record ocr result", { code: error.code });
  }
}

async function loadEvidenceTarget(evidenceId: string): Promise<{
  requestId: string;
  storagePath: string;
  mimeType: string;
} | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leave_request_evidence")
    .select("request_id, storage_path, mime_type")
    .eq("id", evidenceId)
    .is("removed_at", null)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    requestId: data.request_id,
    storagePath: data.storage_path,
    mimeType: data.mime_type,
  };
}

/** Soft-deletes the row, then removes the object. */
export async function removeEvidence(evidenceId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: storagePath, error } = await supabase.rpc(
    "remove_leave_request_evidence",
    { p_evidence_id: evidenceId },
  );

  if (error) {
    throw toLeaveApiError(error, "Could not remove the file.");
  }

  if (storagePath) {
    const { error: removeError } = await supabase.storage
      .from(LEAVE_EVIDENCE_BUCKET)
      .remove([storagePath]);

    if (removeError) {
      // The row is already marked removed, so the file is unreachable through
      // the app either way. Log for cleanup rather than failing the request.
      console.warn("[leave] evidence object cleanup failed", {
        code: removeError.name,
      });
    }
  }
}

/**
 * Signed download URLs for a request's evidence.
 *
 * The signed URL is only issued if the storage policy allows the caller to read
 * the object, so an unauthorized caller gets `null` instead of a URL.
 */
export async function getEvidenceViews(
  requestId: string,
): Promise<EvidenceView[]> {
  const evidence = await listLeaveEvidence(requestId);

  if (evidence.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  return Promise.all(
    evidence.map(async (item) => {
      const { data, error } = await supabase.storage
        .from(LEAVE_EVIDENCE_BUCKET)
        .createSignedUrl(item.storagePath, EVIDENCE_SIGNED_URL_TTL_SECONDS, {
          download: item.originalFilename,
        });

      if (error) {
        console.error("[leave] signed url failed", { code: error.name });
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

/** Raw bytes for report generation. Caller must already be authorized. */
export async function downloadEvidenceBytes(
  storagePath: string,
): Promise<Uint8Array | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(LEAVE_EVIDENCE_BUCKET)
    .download(storagePath);

  if (error || !data) {
    return null;
  }

  return new Uint8Array(await data.arrayBuffer());
}

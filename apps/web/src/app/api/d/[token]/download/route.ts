import { createHash } from "node:crypto";

import { fileDownload, handleRouteError } from "@/lib/api/responses";
import { ApiError } from "@/lib/api/errors";
import { getDriveSubmissionByToken } from "@/lib/db/drive-submissions";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";
import { isB2Configured, signStorageUrl } from "@/lib/storage/b2";
import { isR2Configured } from "@/lib/storage/r2";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;

function isValidSubmissionStoragePath(submission: {
  storage_path: string;
  user_id: string;
}): boolean {
  const storagePath = submission.storage_path;

  if (
    !storagePath ||
    storagePath.includes("..") ||
    storagePath.includes("\\") ||
    storagePath.startsWith("/") ||
    storagePath.startsWith("avatars/") ||
    storagePath.startsWith("class-media/")
  ) {
    return false;
  }

  if (
    storagePath.includes("/") &&
    !storagePath.startsWith(`${submission.user_id}/`)
  ) {
    return false;
  }

  return true;
}

/** Streams the copied file to the lecturer. Token in URL is the credential. */
export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const clientIdentifier = getClientIdentifier(request);
    const rateLimitIdentifier =
      clientIdentifier === "unknown"
        ? createHash("sha256").update(token, "utf8").digest("hex").slice(0, 24)
        : clientIdentifier;

    await enforceRateLimit({
      action: "d:download",
      identifier: rateLimitIdentifier,
      limit: 30,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const submission = await getDriveSubmissionByToken(token);

    if (!submission || !isValidSubmissionStoragePath(submission)) {
      throw new ApiError(404, "not_found", "Submission not found.");
    }

    const bytes = await readStoredBytes(submission);

    return fileDownload(
      bytes,
      submission.drive_file_name,
      submission.mime_type,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

async function readStoredBytes(submission: {
  storage_path: string;
  storage_provider: string;
}): Promise<Uint8Array> {
  if (submission.storage_provider === "supabase") {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from("assignment-attachments")
      .download(submission.storage_path);
    if (error || !data) {
      throw new ApiError(404, "missing_file", "Stored file not found.");
    }
    const bytes = await data.arrayBuffer();
    if (bytes.byteLength > MAX_DOWNLOAD_BYTES) {
      throw new ApiError(413, "too_large", "The stored file is too large.");
    }
    return new Uint8Array(bytes);
  }

  if (
    submission.storage_provider !== "b2" &&
    submission.storage_provider !== "r2"
  ) {
    throw new ApiError(404, "missing_file", "Stored file not found.");
  }

  const configured =
    submission.storage_provider === "r2" ? isR2Configured() : isB2Configured();

  if (!configured) {
    throw new ApiError(503, "not_configured", "Storage not configured.");
  }

  const url = await signStorageUrl(
    submission.storage_provider,
    submission.storage_path,
  );
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new ApiError(404, "missing_file", "Stored file not found.");
  }

  const declaredLength = Number(response.headers.get("content-length") ?? "0");

  if (Number.isFinite(declaredLength) && declaredLength > MAX_DOWNLOAD_BYTES) {
    throw new ApiError(413, "too_large", "The stored file is too large.");
  }

  const body = await response.arrayBuffer();

  if (body.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new ApiError(413, "too_large", "The stored file is too large.");
  }

  return new Uint8Array(body);
}

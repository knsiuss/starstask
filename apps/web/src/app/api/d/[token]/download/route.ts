import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { fileDownload, handleRouteError } from "@/lib/api/responses";
import { ApiError } from "@/lib/api/errors";
import { getDriveSubmissionByToken } from "@/lib/db/drive-submissions";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Streams the copied file to the lecturer. Token in URL is the credential. */
export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await enforceRateLimit({
      action: "d:download",
      identifier: getClientIdentifier(request),
      limit: 30,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const { token } = await context.params;
    const submission = await getDriveSubmissionByToken(token);

    if (!submission) {
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
    return new Uint8Array(await data.arrayBuffer());
  }

  // B2 and R2 buckets are private: sign a short-lived GET instead of building
  // a public URL, so the bytes never leave through an unauthenticated link.
  const bucket = process.env.B2_BUCKET_NAME?.trim();
  const region = process.env.B2_REGION?.trim();
  const keyId = process.env.B2_APPLICATION_KEY_ID?.trim();
  const applicationKey = process.env.B2_APPLICATION_KEY?.trim();
  if (!bucket || !region || !keyId || !applicationKey) {
    throw new ApiError(503, "not_configured", "Storage not configured.");
  }

  const client = new S3Client({
    region,
    endpoint: `https://s3.${region}.backblazeb2.com`,
    credentials: { accessKeyId: keyId, secretAccessKey: applicationKey },
  });
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: submission.storage_path }),
    { expiresIn: 300 },
  );
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError(404, "missing_file", "Stored file not found.");
  }

  return new Uint8Array(await response.arrayBuffer());
}

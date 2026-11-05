import { fileDownload, handleRouteError } from "@/lib/api/responses";
import { ApiError } from "@/lib/api/errors";
import { getDriveSubmissionByToken } from "@/lib/db/drive-submissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Streams the copied file to the lecturer. Token in URL is the credential. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
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

  // B2 and R2 follow the same S3 public URL shape used at upload time.
  const bucket = process.env.B2_BUCKET_NAME?.trim();
  const region = process.env.B2_REGION?.trim();
  if (!bucket || !region) {
    throw new ApiError(503, "not_configured", "Storage not configured.");
  }

  const url = `https://${bucket}.s3.${region}.backblazeb2.com/${submission.storage_path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError(404, "missing_file", "Stored file not found.");
  }

  return new Uint8Array(await response.arrayBuffer());
}

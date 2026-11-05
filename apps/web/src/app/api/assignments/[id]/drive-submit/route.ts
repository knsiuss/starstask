import { assignmentIdSchema } from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { getAssignmentDetail } from "@/lib/db/assignments";
import { insertDriveSubmission } from "@/lib/db/drive-submissions";
import { isSupabaseConfigured } from "@/lib/env/public";
import { validateAttachmentFile } from "@/lib/storage/attachments";
import { uploadToStorage } from "@/lib/storage/b2";

export const dynamic = "force-dynamic";

const DRIVE_FILE_ID_MAX = 512;

/**
 * One-time Drive import: the browser downloads the picked file from the
 * student's own Drive (short-lived token, never stored server-side) and
 * POSTs the bytes here. We validate, copy to our storage, and return a
 * share-token link the student can forward to the lecturer.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw new ApiError(503, "not_configured", "Service not configured.");
    }

    const session = await getSessionUser();
    if (!session) {
      throw new ApiError(401, "unauthorized", "Sign in to submit.");
    }

    const { id } = await context.params;
    const parsed = assignmentIdSchema.safeParse(id);
    if (!parsed.success) {
      throw new ApiError(400, "invalid_id", "Invalid assignment id.");
    }

    const assignment = await getAssignmentDetail(parsed.data);
    if (!assignment) {
      throw new ApiError(404, "not_found", "Assignment not found.");
    }
    if (assignment.user_id === session.user.id) {
      throw new ApiError(
        403,
        "forbidden",
        "You cannot submit to your own assignment.",
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "missing_file", "No file received.");
    }

    const driveFileId = String(form.get("drive_file_id") ?? "").trim();
    if (driveFileId.length > DRIVE_FILE_ID_MAX) {
      throw new ApiError(400, "invalid_file_id", "Invalid Drive file id.");
    }

    const validated = await validateAttachmentFile(file);
    if (!validated.ok) {
      throw new ApiError(422, "invalid_file", validated.error);
    }

    const stored = await uploadToStorage(
      validated.value.originalFilename,
      validated.value.bytes,
      validated.value.mimeType,
    );

    const row = await insertDriveSubmission({
      assignmentId: parsed.data,
      userId: session.user.id,
      driveFileId: driveFileId || null,
      driveFileName: validated.value.originalFilename,
      mimeType: validated.value.mimeType,
      fileSize: validated.value.fileSize,
      storagePath: stored.path,
      storageProvider: stored.provider,
      source: "google_drive",
    });

    return apiSuccess(
      {
        submissionId: row.id,
        fileName: row.drive_file_name,
        lecturerPath: `/d/${row.share_token}`,
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

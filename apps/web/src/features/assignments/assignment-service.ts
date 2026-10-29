import "server-only";

import type { AssignmentCreateInput } from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import {
  DataAccessError,
  deleteAssignmentRecord,
  getOrCreateCourse,
  insertAssignment,
  insertAttachmentRecords,
} from "@/lib/db/assignments";
import {
  ATTACHMENT_BUCKET,
  buildStoragePath,
  validateAttachmentFile,
  type ValidatedAttachment,
} from "@/lib/storage/attachments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateAssignmentResult = { id: string };

/**
 * Creates an assignment, uploads its attachments, and rolls back cleanly when a
 * later step fails. Ownership always comes from the verified `userId`.
 */
export async function createAssignmentForUser(params: {
  userId: string;
  input: AssignmentCreateInput;
  files: File[];
}): Promise<CreateAssignmentResult> {
  const validated: ValidatedAttachment[] = [];

  for (const file of params.files) {
    const result = await validateAttachmentFile(file);

    if (!result.ok) {
      throw new ApiError(400, "invalid_attachment", result.error, {
        attachments: result.error,
      });
    }

    validated.push(result.value);
  }

  const course = await getOrCreateCourse(
    params.input.courseName,
    params.input.courseCode,
    params.input.department,
  );

  let assignmentId: string;

  try {
    assignmentId = await insertAssignment(
      params.userId,
      params.input,
      course.id,
    );
  } catch (error) {
    throw toApiError(error, "Could not create the assignment.");
  }

  const uploadedPaths: string[] = [];

  try {
    const supabase = await createSupabaseServerClient();

    for (const attachment of validated) {
      const storagePath = buildStoragePath(
        params.userId,
        assignmentId,
        attachment.objectName,
      );
      const { error } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(storagePath, attachment.bytes, {
          contentType: attachment.mimeType,
          upsert: false,
          cacheControl: "private, max-age=0",
        });

      if (error) {
        throw new ApiError(
          500,
          "upload_failed",
          "Could not upload the attachments.",
        );
      }

      uploadedPaths.push(storagePath);
    }

    await insertAttachmentRecords(
      assignmentId,
      validated.map((attachment, index) => ({
        storagePath: uploadedPaths[index] ?? "",
        originalFilename: attachment.originalFilename,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
      })),
    );
  } catch (error) {
    await removeObjects(uploadedPaths);
    await deleteAssignmentRecord(params.userId, assignmentId).catch(
      () => undefined,
    );
    throw toApiError(error, "Could not save the attachments.");
  }

  return { id: assignmentId };
}

/** Deletes an owned assignment and its storage objects (best effort). */
export async function deleteAssignmentForUser(
  userId: string,
  assignmentId: string,
): Promise<boolean> {
  const { deleted, storagePaths } = await deleteAssignmentRecord(
    userId,
    assignmentId,
  );

  if (!deleted) {
    return false;
  }

  await removeObjects(storagePaths);

  return true;
}

async function removeObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) {
    return;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .remove(paths);

    if (error) {
      console.error("[storage] cleanup failed", {
        count: paths.length,
        code: error.name,
      });
    }
  } catch (error) {
    console.error("[storage] cleanup threw", {
      count: paths.length,
      name: error instanceof Error ? error.name : "unknown",
    });
  }
}

function toApiError(error: unknown, fallbackMessage: string): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof DataAccessError) {
    console.error("[assignments] database error", { code: error.code });
    return new ApiError(500, "database_error", fallbackMessage);
  }

  console.error("[assignments] unexpected error", {
    name: error instanceof Error ? error.name : typeof error,
  });

  return new ApiError(500, "internal_error", fallbackMessage);
}

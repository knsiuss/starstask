import "server-only";

import type { AssignmentCreateInput } from "@starstask/contracts";

import { ApiError, notFound } from "@/lib/api/errors";
import {
  DataAccessError,
  deleteAssignmentRecord,
  getOrCreateCourse,
  insertAssignment,
  insertAttachmentRecords,
} from "@/lib/db/assignments";
import {
  assertAttachmentCount,
  buildStoragePath,
  validateAttachmentFile,
  type ValidatedAttachment,
} from "@/lib/storage/attachments";
import { deleteStoredObject, uploadToStorageWithKey } from "@/lib/storage/b2";
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
  let hasInvalidFile = false;

  for (const file of params.files) {
    const result = await validateAttachmentFile(file);

    if (!result.ok) {
      hasInvalidFile = true;
      continue;
    }

    validated.push(result.value);
  }

  // File out/nggak allowed → simpan sebagai draft, bukan gagal total.
  const forceDraft = hasInvalidFile;

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
      forceDraft,
    );
  } catch (error) {
    throw toApiError(error, "Could not create the assignment.");
  }

  const uploaded: { storagePath: string; storageProvider: string }[] = [];

  try {
    for (const attachment of validated) {
      const storagePath = buildStoragePath(
        params.userId,
        assignmentId,
        attachment.objectName,
      );

      try {
        const stored = await uploadToStorageWithKey(
          storagePath,
          attachment.bytes,
          attachment.mimeType,
        );
        uploaded.push({
          storagePath: stored.path,
          storageProvider: stored.provider,
        });
      } catch {
        throw new ApiError(
          500,
          "upload_failed",
          "Could not upload the attachments.",
        );
      }
    }

    await insertAttachmentRecords(
      assignmentId,
      validated.map((attachment, index) => ({
        storagePath: uploaded[index]?.storagePath ?? "",
        storageProvider: uploaded[index]?.storageProvider ?? "supabase",
        originalFilename: attachment.originalFilename,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
      })),
    );
  } catch (error) {
    await removeObjects(uploaded);
    await deleteAssignmentRecord(params.userId, assignmentId).catch(
      () => undefined,
    );
    throw toApiError(error, "Could not save the attachments.");
  }

  return { id: assignmentId };
}

export type AddedAttachment = {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
};

/**
 * Adds attachments to an assignment the caller already owns.
 *
 * The upload always uses the caller's storage prefix and the row is written
 * only after every file passed server-side validation. A failed insert removes
 * the objects uploaded in the same request.
 */
export async function addAttachmentsToOwnedAssignment(params: {
  userId: string;
  assignmentId: string;
  files: File[];
}): Promise<AddedAttachment[]> {
  if (params.files.length === 0) {
    throw new ApiError(400, "missing_attachment", "Choose a file to attach.");
  }

  await assertOwnedAssignment(params.userId, params.assignmentId);
  const supabase = await createSupabaseServerClient();
  const { count, error: countReadError } = await supabase
    .from("assignment_attachments")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", params.assignmentId);

  if (countReadError) {
    throw toApiError(countReadError, "Could not check the attachment limit.");
  }

  const countError = assertAttachmentCount((count ?? 0) + params.files.length);

  if (countError) {
    throw new ApiError(400, "too_many_attachments", countError, {
      attachments: countError,
    });
  }

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

  const uploaded: { storagePath: string; storageProvider: string }[] = [];

  try {
    for (const attachment of validated) {
      const storagePath = buildStoragePath(
        params.userId,
        params.assignmentId,
        attachment.objectName,
      );

      try {
        const stored = await uploadToStorageWithKey(
          storagePath,
          attachment.bytes,
          attachment.mimeType,
        );
        uploaded.push({
          storagePath: stored.path,
          storageProvider: stored.provider,
        });
      } catch {
        throw new ApiError(
          500,
          "upload_failed",
          "Could not upload the attachment.",
        );
      }
    }

    const records = await insertAttachmentRecords(
      params.assignmentId,
      validated.map((attachment, index) => ({
        storagePath: uploaded[index]?.storagePath ?? "",
        storageProvider: uploaded[index]?.storageProvider ?? "supabase",
        originalFilename: attachment.originalFilename,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
      })),
    );

    return records.map((record) => ({
      id: record.id,
      originalFilename: record.original_filename,
      mimeType: record.mime_type,
      fileSize: record.file_size,
    }));
  } catch (error) {
    await removeObjects(uploaded);
    throw toApiError(error, "Could not save the attachment.");
  }
}

/** Renames the display name only; the storage object path is untouched. */
export async function renameAttachmentForUser(params: {
  userId: string;
  assignmentId: string;
  attachmentId: string;
  filename: string;
}): Promise<{ id: string; originalFilename: string }> {
  const supabase = await createSupabaseServerClient();
  await assertOwnedAssignment(params.userId, params.assignmentId);

  const { data: existing, error: readError } = await supabase
    .from("assignment_attachments")
    .select("id, original_filename")
    .eq("id", params.attachmentId)
    .eq("assignment_id", params.assignmentId)
    .maybeSingle();

  if (readError) {
    throw toApiError(readError, "Could not load the attachment.");
  }

  if (!existing) {
    throw notFound();
  }

  if (
    fileExtension(existing.original_filename) !== fileExtension(params.filename)
  ) {
    throw new ApiError(
      422,
      "invalid_attachment_name",
      "Keep the original file extension.",
      { filename: "Keep the original file extension." },
    );
  }

  const { data, error } = await supabase
    .from("assignment_attachments")
    .update({ original_filename: params.filename.trim() })
    .eq("id", params.attachmentId)
    .eq("assignment_id", params.assignmentId)
    .select("id, original_filename")
    .maybeSingle();

  if (error) {
    throw toApiError(error, "Could not rename the attachment.");
  }

  if (!data) {
    throw notFound();
  }

  return { id: data.id, originalFilename: data.original_filename };
}

/** Removes an attachment from an assignment the caller owns. */
export async function deleteAttachmentForUser(params: {
  userId: string;
  assignmentId: string;
  attachmentId: string;
}): Promise<boolean> {
  await assertOwnedAssignment(params.userId, params.assignmentId);
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: readError } = await supabase
    .from("assignment_attachments")
    .select("id, storage_path, storage_provider")
    .eq("id", params.attachmentId)
    .eq("assignment_id", params.assignmentId)
    .maybeSingle();

  if (readError) {
    throw toApiError(readError, "Could not load the attachment.");
  }

  if (!existing) {
    return false;
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("assignment_attachments")
    .delete()
    .eq("id", params.attachmentId)
    .eq("assignment_id", params.assignmentId)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    throw toApiError(deleteError, "Could not delete the attachment.");
  }

  if (!deleted) {
    return false;
  }

  await removeObjects([
    {
      storagePath: existing.storage_path,
      storageProvider: existing.storage_provider ?? "supabase",
    },
  ]);

  return true;
}

async function assertOwnedAssignment(
  userId: string,
  assignmentId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("id")
    .eq("id", assignmentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw toApiError(error, "Could not verify the assignment.");
  }

  if (!data) {
    throw notFound();
  }
}

function fileExtension(filename: string): string {
  const separator = filename.lastIndexOf(".");

  return separator > 0 ? filename.slice(separator + 1).toLowerCase() : "";
}

/** Deletes an owned assignment and its storage objects (best effort). */
export async function deleteAssignmentForUser(
  userId: string,
  assignmentId: string,
): Promise<boolean> {
  const { deleted, attachments } = await deleteAssignmentRecord(
    userId,
    assignmentId,
  );

  if (!deleted) {
    return false;
  }

  await removeObjects(attachments);

  return true;
}

async function removeObjects(
  objects: { storagePath: string; storageProvider: string }[],
): Promise<void> {
  for (const object of objects) {
    try {
      await deleteStoredObject(object.storageProvider, object.storagePath);
    } catch (error) {
      console.error("[storage] cleanup threw", {
        provider: object.storageProvider,
        name: error instanceof Error ? error.name : "unknown",
      });
    }
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

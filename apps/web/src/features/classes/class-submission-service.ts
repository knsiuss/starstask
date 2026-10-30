import "server-only";

import type {
  ClassSubmissionCreateInput,
  ClassSubmissionReviseInput,
} from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import {
  deleteAssignmentRecord,
  insertAttachmentRecords,
} from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  assertAttachmentCount,
  ATTACHMENT_BUCKET,
  buildStoragePath,
  validateAttachmentFile,
  type ValidatedAttachment,
} from "@/lib/storage/attachments";
import { toClassApiError } from "@/features/classes/errors";

export type ClassSubmissionResult = {
  id: string;
  /** A class admin's own post publishes immediately; a member's waits for review. */
  status: "published" | "pending_review";
};

/**
 * Creates a class assignment and uploads its attachments.
 *
 * The row is created by `submit_class_assignment`, which verifies membership and
 * class state and picks the status itself: `draft` for a class admin (nobody else
 * could approve their post) and `pending_review` for a member. A class-admin post
 * is published by `publish_class_assignment` only after the attachments land, so
 * a public post is never half-saved. If either step fails, the row and any
 * uploaded objects are removed.
 */
export async function createClassSubmission(params: {
  classId: string;
  input: ClassSubmissionCreateInput;
  files: File[];
  publishAsClassPost: boolean;
}): Promise<ClassSubmissionResult> {
  const validated = await validateFiles(params.files);
  const supabase = await createSupabaseServerClient();

  const { data: assignmentId, error } = await supabase.rpc(
    "submit_class_assignment",
    {
      p_class_id: params.classId,
      p_title: params.input.title,
      p_description: params.input.description,
      p_deadline: params.input.deadline ?? null,
      p_assignment_type: params.input.assignmentType ?? null,
      p_tags: params.input.tags,
      p_reference_urls: params.input.referenceUrls,
    },
  );

  if (error || !assignmentId) {
    throw toClassApiError(error, "Could not submit the assignment.");
  }

  try {
    await uploadAttachments(assignmentId, validated);

    if (params.publishAsClassPost) {
      const { error: publishError } = await supabase.rpc(
        "publish_class_assignment",
        { p_assignment_id: assignmentId },
      );

      if (publishError) {
        throw toClassApiError(publishError, "Could not publish the post.");
      }

      return { id: assignmentId, status: "published" };
    }
  } catch (failure) {
    await deleteOwnSubmission(assignmentId).catch(() => undefined);
    throw failure;
  }

  return { id: assignmentId, status: "pending_review" };
}

/**
 * Revises a rejected submission and returns it to the review queue.
 *
 * New attachments are uploaded first: the assignment already exists and is
 * owned by the caller, so the storage policy accepts the write. Only after the
 * upload succeeds does the row move back to `pending_review`.
 */
export async function reviseClassSubmission(params: {
  assignmentId: string;
  input: ClassSubmissionReviseInput;
  files: File[];
}): Promise<void> {
  const validated = await validateFiles(params.files);
  const existingCount = await countExistingAttachments(params.assignmentId);
  const countError = assertAttachmentCount(existingCount + validated.length);

  if (countError) {
    throw new ApiError(400, "too_many_attachments", countError, {
      attachments: countError,
    });
  }

  const uploadedPaths: string[] = [];

  try {
    uploadedPaths.push(
      ...(await uploadAttachments(params.assignmentId, validated)),
    );

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("revise_class_assignment", {
      p_assignment_id: params.assignmentId,
      p_title: params.input.title,
      p_description: params.input.description,
      p_deadline: params.input.deadline ?? null,
      p_assignment_type: params.input.assignmentType ?? null,
      p_tags: params.input.tags,
      p_reference_urls: params.input.referenceUrls,
    });

    if (error) {
      throw toClassApiError(error, "Could not revise the assignment.");
    }
  } catch (error) {
    await removeObjects(uploadedPaths);
    throw error;
  }
}

async function validateFiles(files: File[]): Promise<ValidatedAttachment[]> {
  const countError = assertAttachmentCount(files.length);

  if (countError) {
    throw new ApiError(400, "too_many_attachments", countError, {
      attachments: countError,
    });
  }

  const validated: ValidatedAttachment[] = [];

  for (const file of files) {
    const result = await validateAttachmentFile(file);

    if (!result.ok) {
      throw new ApiError(400, "invalid_attachment", result.error, {
        attachments: result.error,
      });
    }

    validated.push(result.value);
  }

  return validated;
}

/** Uploads every file and records it; returns the storage paths it created. */
async function uploadAttachments(
  assignmentId: string,
  validated: ValidatedAttachment[],
): Promise<string[]> {
  if (validated.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, "unauthorized", "Sign in to continue.");
  }

  const uploadedPaths: string[] = [];

  try {
    for (const attachment of validated) {
      const storagePath = buildStoragePath(
        user.id,
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
    throw error;
  }

  return uploadedPaths;
}

async function countExistingAttachments(assignmentId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("assignment_attachments")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId);

  if (error) {
    throw toClassApiError(error, "Could not inspect the attachments.");
  }

  return count ?? 0;
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
      console.error("[storage] class attachment cleanup failed", {
        count: paths.length,
        code: error.name,
      });
    }
  } catch (error) {
    console.error("[storage] class attachment cleanup threw", {
      count: paths.length,
      name: error instanceof Error ? error.name : "unknown",
    });
  }
}

/**
 * Rollback for a submission whose attachments could not be saved. The delete
 * policy limits this to the caller's own row, so a failed cleanup can never
 * remove somebody else's submission.
 */
async function deleteOwnSubmission(assignmentId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { storagePaths } = await deleteAssignmentRecord(user.id, assignmentId);
  await removeObjects(storagePaths);
}

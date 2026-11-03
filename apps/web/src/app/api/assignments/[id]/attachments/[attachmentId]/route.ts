import {
  assignmentIdSchema,
  attachmentIdSchema,
  attachmentRemovalSchema,
  attachmentRenameSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { recordAppActivity } from "@/lib/observability/events";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  deleteAttachmentForUser,
  renameAttachmentForUser,
} from "@/features/assignments/assignment-service";
import { requireSession } from "@/features/classes/class-access";
import { removeSensitiveAttachment } from "@/features/classes/class-review-service";

export const dynamic = "force-dynamic";

/** Enough for a 255-character filename or a 2,000-character review reason. */
const MAX_JSON_BYTES = 8 * 1024;

type RouteContext = {
  params: Promise<{ id: string; attachmentId: string }>;
};

/** Renames the display name without touching the storage object path. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const { id, attachmentId } = await context.params;

    const parsedAssignment = assignmentIdSchema.safeParse(id);
    const parsedAttachment = attachmentIdSchema.safeParse(attachmentId);

    if (!parsedAssignment.success || !parsedAttachment.success) {
      throw new ApiError(400, "invalid_id", "Invalid attachment reference.");
    }

    await enforceRateLimit({
      action: "assignments:attachments:rename",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    assertBodySize(request);

    const parsed = attachmentRenameSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the file name.",
        toFieldErrors(parsed.error),
      );
    }

    const renamed = await renameAttachmentForUser({
      userId: session.user.id,
      assignmentId: parsedAssignment.data,
      attachmentId: parsedAttachment.data,
      filename: parsed.data.filename,
    });

    await recordAppActivity({
      actorId: session.user.id,
      eventType: "assignment_updated",
      resourceType: "assignment",
      resourceId: parsedAssignment.data,
    });

    return apiSuccess(renamed);
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Deletes an attachment in two modes:
 *
 * - With a reason, a class reviewer removes sensitive content. The reason is
 *   recorded in the audit trail.
 * - Without a body, the assignment owner removes their own file. Ownership is
 *   verified from the session, never from the request.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const { id, attachmentId } = await context.params;

    const parsedAssignment = assignmentIdSchema.safeParse(id);
    const parsedAttachment = attachmentIdSchema.safeParse(attachmentId);

    if (!parsedAssignment.success || !parsedAttachment.success) {
      throw new ApiError(400, "invalid_id", "Invalid attachment reference.");
    }

    await enforceRateLimit({
      action: "assignments:attachments:remove",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    assertBodySize(request);

    const body = await readJsonBody(request);
    const reason = readRemovalReason(body);

    if (reason !== null) {
      const parsed = attachmentRemovalSchema.safeParse(body);

      if (!parsed.success) {
        throw new ApiError(
          422,
          "validation_error",
          "A removal reason is required.",
          toFieldErrors(parsed.error),
        );
      }

      await removeSensitiveAttachment(
        parsedAttachment.data,
        parsed.data.reason,
      );

      return apiSuccess({ id: parsedAttachment.data });
    }

    const deleted = await deleteAttachmentForUser({
      userId: session.user.id,
      assignmentId: parsedAssignment.data,
      attachmentId: parsedAttachment.data,
    });

    if (!deleted) {
      throw notFound();
    }

    await recordAppActivity({
      actorId: session.user.id,
      eventType: "assignment_updated",
      resourceType: "assignment",
      resourceId: parsedAssignment.data,
    });

    return apiSuccess({ id: parsedAttachment.data });
  } catch (error) {
    return handleRouteError(error);
  }
}

function assertBodySize(request: Request): void {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new ApiError(
      413,
      "payload_too_large",
      "The request body is too large.",
    );
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const raw = await request.text();

  if (raw.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(
      400,
      "invalid_json",
      "The request body could not be read.",
    );
  }
}

function readRemovalReason(body: unknown): string | null {
  if (
    typeof body === "object" &&
    body !== null &&
    "reason" in body &&
    typeof body.reason === "string"
  ) {
    return body.reason;
  }

  return null;
}

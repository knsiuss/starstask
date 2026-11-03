import { assignmentIdSchema } from "@starstask/contracts";

import { collectFiles } from "@/lib/api/assignment-payload";
import {
  ApiError,
  notFound,
  serviceUnavailable,
  unauthorized,
} from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { recordAppActivity } from "@/lib/observability/events";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { addAttachmentsToOwnedAssignment } from "@/features/assignments/assignment-service";

/** One 10 MB file plus multipart overhead. */
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "assignments:attachments:add",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 3600,
      onBackendFailure: "closed",
    });

    const declaredLength = Number(request.headers.get("content-length") ?? "0");

    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      throw new ApiError(413, "payload_too_large", "The upload is too large.");
    }

    const { id } = await context.params;
    const parsedId = assignmentIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(400, "invalid_id", "The assignment id is invalid.");
    }

    let form: FormData;

    try {
      form = await request.formData();
    } catch {
      throw new ApiError(
        400,
        "invalid_form",
        "The form data could not be read.",
      );
    }

    const files = collectFiles(form).slice(0, 1);

    if (files.length === 0) {
      throw new ApiError(400, "missing_attachment", "Choose a file to attach.");
    }

    const added = await addAttachmentsToOwnedAssignment({
      userId: session.user.id,
      assignmentId: parsedId.data,
      files,
    });

    if (added.length === 0) {
      throw notFound();
    }

    await recordAppActivity({
      actorId: session.user.id,
      eventType: "assignment_updated",
      resourceType: "assignment",
      resourceId: parsedId.data,
    });

    return apiSuccess(added, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export const dynamic = "force-dynamic";

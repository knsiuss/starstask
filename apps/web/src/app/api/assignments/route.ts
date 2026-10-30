import {
  assignmentCreateSchema,
  listAssignmentsQuerySchema,
  toFieldErrors,
} from "@starstask/contracts";

import {
  collectFiles,
  isHoneypotTripped,
  parseAssignmentForm,
} from "@/lib/api/assignment-payload";
import { ApiError, serviceUnavailable, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { listAssignments } from "@/lib/db/assignments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { recordAppActivity } from "@/lib/observability/events";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createAssignmentForUser } from "@/features/assignments/assignment-service";
import { assertAttachmentCount } from "@/lib/storage/attachments";

const MAX_REQUEST_BYTES = 34 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "assignments:list",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 60,
    });

    const url = new URL(request.url);
    const parsed = listAssignmentsQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );

    if (!parsed.success) {
      throw new ApiError(
        400,
        "invalid_query",
        "One or more filters are invalid.",
        toFieldErrors(parsed.error),
      );
    }

    const result = await listAssignments(parsed.data);

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "assignments:create",
      identifier: session.user.id,
      limit: 10,
      windowSeconds: 3600,
    });

    const declaredLength = Number(request.headers.get("content-length") ?? "0");

    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      throw new ApiError(413, "payload_too_large", "The upload is too large.");
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

    if (isHoneypotTripped(form)) {
      throw new ApiError(
        400,
        "rejected",
        "The submission could not be processed.",
      );
    }

    const parsed = assignmentCreateSchema.safeParse(parseAssignmentForm(form));

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const files = collectFiles(form);
    const countError = assertAttachmentCount(files.length);

    if (countError) {
      throw new ApiError(400, "too_many_attachments", countError, {
        attachments: countError,
      });
    }

    const result = await createAssignmentForUser({
      userId: session.user.id,
      input: parsed.data,
      files,
    });

    await recordAppActivity({
      actorId: session.user.id,
      eventType: "assignment_created",
      resourceType: "assignment",
      resourceId: result.id,
    });

    return apiSuccess(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export const dynamic = "force-dynamic";

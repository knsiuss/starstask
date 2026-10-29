import {
  classSubmissionCreateSchema,
  reviewQueueQuerySchema,
  toFieldErrors,
} from "@starstask/contracts";

import {
  collectFiles,
  isHoneypotTripped,
  parseClassSubmissionForm,
} from "@/lib/api/assignment-payload";
import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { listClassSubmissions } from "@/lib/db/class-submissions";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  requireClassManager,
  requireClassMember,
} from "@/features/classes/class-access";
import { createClassSubmission } from "@/features/classes/class-submission-service";

const MAX_REQUEST_BYTES = 34 * 1024 * 1024;

export const dynamic = "force-dynamic";

/** Review queue for one class. Only its class admins can list it. */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "classes:submissions:list",
      identifier: session.user.id,
      limit: 240,
      windowSeconds: 3600,
    });

    const url = new URL(request.url);
    const parsed = reviewQueueQuerySchema.safeParse(
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

    const result = await listClassSubmissions({
      classId: found.id,
      status: parsed.data.status,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Creates a submission in `pending_review`.
 *
 * Membership and class state are verified by `submit_class_assignment`; the
 * route only parses and validates the form.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassMember(slug);

    await enforceRateLimit({
      action: "classes:submissions:create",
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

    const parsed = classSubmissionCreateSchema.safeParse(
      parseClassSubmissionForm(form),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const result = await createClassSubmission({
      classId: found.id,
      input: parsed.data,
      files: collectFiles(form),
    });

    return apiSuccess(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

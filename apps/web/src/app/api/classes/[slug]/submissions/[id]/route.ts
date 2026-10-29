import {
  assignmentIdSchema,
  classSubmissionReviseSchema,
  toFieldErrors,
} from "@starstask/contracts";

import {
  collectFiles,
  parseClassSubmissionForm,
} from "@/lib/api/assignment-payload";
import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSubmissionDetail } from "@/lib/db/class-submissions";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClass } from "@/features/classes/class-access";
import { requireSession } from "@/features/classes/class-access";
import { reviseClassSubmission } from "@/features/classes/class-submission-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string; id: string }> };

/**
 * Revises a rejected submission and returns it to the review queue.
 *
 * `revise_class_assignment` enforces ownership and the rejected/draft status.
 * The route only makes sure the submission really belongs to this class.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, id } = await context.params;
    const session = await requireSession();
    const found = await requireClass(slug);

    const parsedId = assignmentIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(400, "invalid_id", "Invalid submission id.");
    }

    await enforceRateLimit({
      action: "classes:submissions:revise",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 3600,
    });

    const detail = await getSubmissionDetail(parsedId.data);

    if (
      !detail ||
      detail.class_id !== found.id ||
      detail.submitter.id !== session.user.id
    ) {
      throw notFound();
    }

    const form = await request.formData();
    const parsed = classSubmissionReviseSchema.safeParse(
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

    await reviseClassSubmission({
      assignmentId: parsedId.data,
      input: parsed.data,
      files: collectFiles(form),
    });

    return apiSuccess({ id: parsedId.data });
  } catch (error) {
    return handleRouteError(error);
  }
}

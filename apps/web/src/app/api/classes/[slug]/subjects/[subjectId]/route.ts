import {
  classSubjectUpdateSchema,
  subjectIdSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import {
  deleteClassSubject,
  getClassSubjectById,
  updateClassSubject,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  requireClassManager,
  requireClassMember,
} from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; subjectId: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, subjectId } = await context.params;
    const { session, class: found } = await requireClassMember(slug);

    await enforceRateLimit({
      action: "classes:subjects:get",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const subject = await getClassSubjectById(subjectId);

    if (!subject || subject.class_id !== found.id) {
      throw notFound();
    }

    return apiSuccess(subject);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string; subjectId: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, subjectId } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "classes:subjects:update",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const subject = await getClassSubjectById(subjectId);

    if (!subject || subject.class_id !== found.id) {
      throw notFound();
    }

    const parsed = classSubjectUpdateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check your subject update details.",
        toFieldErrors(parsed.error),
      );
    }

    await updateClassSubject(subjectId, parsed.data);

    return apiSuccess({ updated: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Removes a subject from the class. Only a class manager may do this.
 * Assignments keep existing without a subject; the subject's schedule rows
 * cascade away.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ slug: string; subjectId: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, subjectId } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    const parsedId = subjectIdSchema.safeParse(subjectId);

    if (!parsedId.success) {
      throw notFound();
    }

    await enforceRateLimit({
      action: "classes:subjects:delete",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const subject = await getClassSubjectById(parsedId.data);

    if (!subject || subject.class_id !== found.id) {
      throw notFound();
    }

    await deleteClassSubject(parsedId.data);

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

import {
  courseMaterialIdSchema,
  courseMaterialUpdateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getClassSubject } from "@/lib/db/classes";
import {
  deleteCourseMaterial,
  updateCourseMaterial,
} from "@/lib/db/course-materials";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string; materialId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, materialId } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "classes:materials:update",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsedId = courseMaterialIdSchema.safeParse(materialId);

    if (!parsedId.success) {
      throw notFound();
    }

    const parsed = courseMaterialUpdateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the material details.",
        toFieldErrors(parsed.error),
      );
    }

    const course = await getClassSubject(found.id, parsed.data.subjectId);

    if (!course) {
      throw new ApiError(
        422,
        "invalid_course",
        "Choose a course of this class.",
        { subjectId: "Choose a course of this class." },
      );
    }

    if (course.status === "archived") {
      throw new ApiError(
        409,
        "course_archived",
        "This course is archived and cannot be edited.",
        { subjectId: "Choose an active course." },
      );
    }

    await updateCourseMaterial({
      classId: found.id,
      materialId: parsedId.data,
      input: parsed.data,
    });

    return apiSuccess({ updated: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, materialId } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "classes:materials:delete",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsedId = courseMaterialIdSchema.safeParse(materialId);

    if (!parsedId.success) {
      throw notFound();
    }

    await deleteCourseMaterial({
      classId: found.id,
      materialId: parsedId.data,
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

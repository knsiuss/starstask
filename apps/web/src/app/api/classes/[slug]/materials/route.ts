import {
  courseMaterialCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getClassSubject } from "@/lib/db/classes";
import { createCourseMaterial } from "@/lib/db/course-materials";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

/** Creates one learning material for a course the caller manages. */
export async function POST(
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
      action: "classes:materials:create",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = courseMaterialCreateSchema.safeParse(await request.json());

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
        "This course is archived and cannot receive new materials.",
        { subjectId: "Choose an active course." },
      );
    }

    const id = await createCourseMaterial({
      classId: found.id,
      subjectId: course.id,
      userId: session.user.id,
      input: parsed.data,
    });

    return apiSuccess({ id }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

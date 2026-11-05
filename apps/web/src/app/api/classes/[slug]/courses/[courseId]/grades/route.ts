import {
  courseComponentGradeSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { setCourseComponentGrade } from "@/lib/db/course-grades";
import { getClassSubject } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string; courseId: string }>;
};

/**
 * Inline component grade (Tugas/UTS/UAS) for the attendance sheet.
 *
 * The database function is the security boundary: it requires a class
 * manager, validates membership and the 0–100 range, and audits the write.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, courseId } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    const course = await getClassSubject(found.id, courseId);

    if (!course) {
      throw new ApiError(404, "not_found", "Course not found in this class.");
    }

    await enforceRateLimit({
      action: "course:grades:set",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3_600,
    });

    const parsed = courseComponentGradeSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the grade details.",
        toFieldErrors(parsed.error),
      );
    }

    const score = await setCourseComponentGrade(
      found.id,
      course.id,
      parsed.data,
    );

    return apiSuccess({ score });
  } catch (error) {
    return handleRouteError(error);
  }
}

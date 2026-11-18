import {
  courseCommentReactionSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { requireClassMember } from "@/features/classes/class-access";
import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getClassSubject } from "@/lib/db/classes";
import { canAccessCourse } from "@/lib/db/course-access";
import { toggleCourseCommentReaction } from "@/lib/db/course-comments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ slug: string; courseId: string; commentId: string }>;
  },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, courseId, commentId } = await context.params;
    const { session, class: found, role } = await requireClassMember(slug);

    await enforceRateLimit({
      action: "classes:courses:comments:react",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 60,
    });

    const course = await getClassSubject(found.id, courseId);

    if (
      !course ||
      (!role.canManage &&
        !(await canAccessCourse(found.id, session.user.id, course.id)))
    ) {
      throw new ApiError(404, "not_found", "Course not found.");
    }

    const parsed = courseCommentReactionSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Choose a valid emoji.",
        toFieldErrors(parsed.error),
      );
    }

    const reactions = await toggleCourseCommentReaction({
      classId: found.id,
      subjectId: course.id,
      commentId,
      userId: session.user.id,
      emoji: parsed.data.emoji,
    });

    return apiSuccess({ reactions });
  } catch (error) {
    return handleRouteError(error);
  }
}

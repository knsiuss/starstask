import { requireClassMember } from "@/features/classes/class-access";
import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getClassSubject } from "@/lib/db/classes";
import { canAccessCourse } from "@/lib/db/course-access";
import { deleteCourseComment } from "@/lib/db/course-comments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
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
      action: "classes:courses:comments:delete",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 300,
    });

    const course = await getClassSubject(found.id, courseId);

    if (
      !course ||
      (!role.canManage &&
        !(await canAccessCourse(found.id, session.user.id, course.id)))
    ) {
      throw new ApiError(404, "not_found", "Course not found.");
    }

    await deleteCourseComment({
      classId: found.id,
      subjectId: course.id,
      commentId,
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

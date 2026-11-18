import { z } from "zod";

import { requireClassMember } from "@/features/classes/class-access";
import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { listClassSubjects } from "@/lib/db/classes";
import {
  getMemberCourseAccess,
  setMemberCourseAccess,
} from "@/lib/db/course-access";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const selfCourseAccessSchema = z.object({
  scope: z.enum(["all", "selected"]),
  subjectIds: z.array(z.uuid()).default([]),
});

/**
 * Returns the caller's course access scope and active subjects in a class
 * they belong to (used right after joining via invitation).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassMember(slug);

    const [access, subjects] = await Promise.all([
      getMemberCourseAccess(found.id, session.user.id),
      listClassSubjects(found.id, { includeArchived: false }),
    ]);

    const realSubjects = subjects
      .filter((item) => item.id !== found.id)
      .map((item) => ({ id: item.id, name: item.name, code: item.code }));

    return apiSuccess({
      scope: access.scope,
      subjectIds: [...access.allowedSubjectIds],
      subjects: realSubjects,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Updates the signed-in member's own course access selection inside a class.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found, role } = await requireClassMember(slug);

    await enforceRateLimit({
      action: "classes:members:me:courses:update",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 300,
    });

    const parsed = selfCourseAccessSchema.safeParse(
      await request.json().catch(() => null),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Invalid course selection payload.",
      );
    }

    if (!role.canManage && parsed.data.scope === "all") {
      const currentAccess = await getMemberCourseAccess(
        found.id,
        session.user.id,
      );

      if (currentAccess.scope === "selected") {
        throw new ApiError(
          403,
          "forbidden",
          "Only class managers can restore access to all courses.",
        );
      }
    }

    await setMemberCourseAccess({
      classId: found.id,
      userId: session.user.id,
      scope: parsed.data.scope,
      subjectIds: parsed.data.subjectIds,
    });

    return apiSuccess({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

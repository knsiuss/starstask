import { z } from "zod";

import { requireClassManager } from "@/features/classes/class-access";
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

const updateSchema = z.object({
  userId: z.uuid("Invalid user"),
  scope: z.enum(["all", "selected"]),
  subjectIds: z.array(z.uuid()).default([]),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { class: found } = await requireClassManager(slug);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") ?? "";

    if (!z.uuid().safeParse(userId).success) {
      throw new ApiError(422, "validation_error", "Invalid member id.");
    }

    const [access, subjects] = await Promise.all([
      getMemberCourseAccess(found.id, userId),
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

export async function PUT(
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
      action: "classes:members:courses:update",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 300,
    });

    const parsed = updateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Invalid course access payload.",
      );
    }

    await setMemberCourseAccess({
      classId: found.id,
      userId: parsed.data.userId,
      scope: parsed.data.scope,
      subjectIds: parsed.data.subjectIds,
    });

    return apiSuccess({ updated: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

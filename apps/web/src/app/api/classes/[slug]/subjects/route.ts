import {
  classSubjectCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import {
  createClassSubject,
  listClassSubjects,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  requireClassManager,
  requireClassMember,
} from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

/**
 * Returns subjects/subclasses available in this main class group.
 * Accessible to any active member of the class.
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
    const { session, class: found, role } = await requireClassMember(slug);

    await enforceRateLimit({
      action: "classes:subjects:list",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const subjects = await listClassSubjects(found.id, {
      includeArchived: role.canManage,
    });

    return apiSuccess(subjects);
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Creates a new subject inside the main class group.
 * Only Class Admins (or Platform Admins) managing this class group can create subjects.
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
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "classes:subjects:create",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = classSubjectCreateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check your subject details.",
        toFieldErrors(parsed.error),
      );
    }

    const subjectId = await createClassSubject(found.id, parsed.data);

    return apiSuccess({ id: subjectId });
  } catch (error) {
    return handleRouteError(error);
  }
}

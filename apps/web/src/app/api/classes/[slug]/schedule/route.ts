import { classScheduleCreateSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import {
  createClassScheduleEntry,
  listClassSchedule,
} from "@/lib/db/class-schedule";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassMember } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

/** Weekly course schedule of the class. Visible to its members. */
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

    await enforceRateLimit({
      action: "classes:schedule:list",
      identifier: session.user.id,
      limit: 240,
      windowSeconds: 3600,
    });

    const entries = await listClassSchedule(found.id);

    return apiSuccess(entries);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Adds a recurring weekly slot. Every class member may maintain it. */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassMember(slug);

    await enforceRateLimit({
      action: "classes:schedule:create",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = classScheduleCreateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the schedule details.",
        toFieldErrors(parsed.error),
      );
    }

    const id = await createClassScheduleEntry(
      found.id,
      session.user.id,
      parsed.data,
    );

    return apiSuccess({ id }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

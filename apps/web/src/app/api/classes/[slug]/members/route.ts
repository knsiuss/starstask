import { memberUserIdSchema, toFieldErrors } from "@starstask/contracts";
import { z } from "zod";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { listClassMembers } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassManager } from "@/features/classes/class-access";
import { removeClassMember } from "@/features/classes/class-management-service";

export const dynamic = "force-dynamic";

const removeMemberSchema = z.object({ userId: memberUserIdSchema }).strict();

/**
 * Member roster for a class manager.
 *
 * The response carries display names, avatars, and bios, never private profile
 * fields such as NIM or full name.
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
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "classes:members:list",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    return apiSuccess(await listClassMembers(found.id));
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Removes a member. Only a class manager may do this. Removing a class admin
 * also removes their admin row (the foreign key cascades), and the function
 * refuses to leave a class with no admin.
 */
export async function DELETE(
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
      action: "classes:members:remove",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const parsed = removeMemberSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Choose a valid member.",
        toFieldErrors(parsed.error),
      );
    }

    await removeClassMember(found.id, parsed.data.userId);

    return apiSuccess({ userId: parsed.data.userId });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { memberUserIdSchema, toFieldErrors } from "@starstask/contracts";
import { z } from "zod";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  requireClass,
  requirePlatformAdmin,
} from "@/features/classes/class-access";
import {
  assignClassAdmin,
  revokeClassAdmin,
} from "@/features/classes/class-management-service";

export const dynamic = "force-dynamic";

const adminChangeSchema = z.object({ userId: memberUserIdSchema }).strict();

/**
 * Grants a class admin role.
 *
 * Only platform admins may promote somebody; class admins cannot create peers
 * or elevate themselves. The database function repeats this check.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requirePlatformAdmin();
    const { slug } = await context.params;
    const found = await requireClass(slug);

    await enforceRateLimit({
      action: "classes:admins:assign",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = adminChangeSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Choose a valid user.",
        toFieldErrors(parsed.error),
      );
    }

    await assignClassAdmin(found.id, parsed.data);

    return apiSuccess({ userId: parsed.data.userId, isAdmin: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Revokes a class admin role. The class always keeps at least one admin. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requirePlatformAdmin();
    const { slug } = await context.params;
    const found = await requireClass(slug);

    await enforceRateLimit({
      action: "classes:admins:revoke",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = adminChangeSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Choose a valid user.",
        toFieldErrors(parsed.error),
      );
    }

    await revokeClassAdmin(found.id, parsed.data.userId);

    return apiSuccess({ userId: parsed.data.userId, isAdmin: false });
  } catch (error) {
    return handleRouteError(error);
  }
}

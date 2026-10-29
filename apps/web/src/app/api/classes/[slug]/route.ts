import { classMetadataUpdateSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { getClassRole, getClassBySlug } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { notFound } from "@/lib/api/errors";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";
import { requireClassManager } from "@/features/classes/class-access";
import { updateClassMetadata } from "@/features/classes/class-management-service";

export const dynamic = "force-dynamic";

/**
 * Class detail. Archived classes stay readable for their members but are
 * invisible to anonymous visitors through RLS, so this returns 404 for them.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const found = await getClassBySlug(slug);

    if (!found) {
      throw notFound();
    }

    const session = await getSessionUser();

    await enforceRateLimit({
      action: "classes:detail",
      identifier: session?.user.id ?? getClientIdentifier(request),
      limit: 240,
      windowSeconds: 60,
    });

    // Role predicates are granted to `authenticated` only; anonymous callers
    // simply get the public class metadata without a role block.
    const role = session ? await getClassRole(found.id) : null;

    return apiSuccess({ class: found, role });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Updates class metadata. Class admins may edit their own class only. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found, role } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "classes:update",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = classMetadataUpdateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    // `update_class_metadata` re-checks can_manage_class, so a caller that
    // bypassed this route still cannot edit another class.
    await updateClassMetadata(found.id, parsed.data);

    return apiSuccess({ id: found.id, slug: found.slug, role: role.canManage });
  } catch (error) {
    return handleRouteError(error);
  }
}

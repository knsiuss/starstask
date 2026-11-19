import { z } from "zod";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getClassRole } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClass, requireSession } from "@/features/classes/class-access";
import { leaveMyClass } from "@/features/classes/self-leave-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_JSON_BYTES = 1024;

/** Empty object; authoritative identity comes from the session. */
const leaveSchema = z.object({}).strict();

/**
 * Caller leaves the class identified by the URL slug.
 *
 * Identity comes from the server session; no user id is taken from the
 * client. `leave_my_class` auto-promotes the longest-tenured member when the
 * caller is the last class admin.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "classes:leave",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 300,
      onBackendFailure: "closed",
    });

    const parsed = leaveSchema.safeParse(await readJson(request));

    if (!parsed.success) {
      throw new ApiError(422, "validation_error", "Send an empty body.");
    }

    const { slug } = await context.params;
    const found = await requireClass(slug);
    const role = await getClassRole(found.id);

    if (!role.isMember) {
      throw new ApiError(
        403,
        "not_a_member",
        "You are not a member of this class.",
      );
    }

    const result = await leaveMyClass(session, found.id);

    return apiSuccess({
      status: result.status,
      promotedUserId: result.promotedUserId,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function readJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new ApiError(
      413,
      "payload_too_large",
      "The request body is too large.",
    );
  }

  try {
    const text = await request.text();

    if (text.trim() === "") {
      return {};
    }

    return JSON.parse(text);
  } catch {
    throw new ApiError(
      400,
      "invalid_json",
      "The request body could not be read.",
    );
  }
}

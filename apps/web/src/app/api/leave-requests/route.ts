import {
  leaveRequestCreateSchema,
  leaveRequestListQuerySchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireSession } from "@/features/classes/class-access";
import { listLeaveRequestsForStudent } from "@/lib/db/leave";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createLeaveRequest } from "@/features/leave/leave-service";

export const dynamic = "force-dynamic";

/** A student's own leave requests. RLS limits rows to the caller. */
export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "leave-requests:list",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 60,
    });

    const url = new URL(request.url);
    const parsed = leaveRequestListQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Those filters are not valid.",
      );
    }

    const result = await listLeaveRequestsForStudent(session.user.id, {
      status: parsed.data.status,
      from: parsed.data.from,
      to: parsed.data.to,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Creates a draft.
 *
 * The student id comes from the verified session, never from the body. Class
 * membership is re-checked inside `create_leave_request`.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "leave-requests:create",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 60,
    });

    const body = (await request.json()) as unknown;
    const parsed = leaveRequestCreateSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const created = await createLeaveRequest(parsed.data);

    return apiSuccess(created, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export const runtime = "nodejs";

import { leaveRequestIdSchema, toFieldErrors } from "@starstask/contracts";
import { z } from "zod";

import { requireClassManager } from "@/features/classes/class-access";
import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getLeaveRequestById } from "@/lib/db/leave";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const lecturerOutcomeSchema = z.object({
  outcome: z.enum(["approved", "rejected", "awaiting"]),
  note: z.string().trim().max(2000).optional(),
});

type RouteContext = { params: Promise<{ slug: string; id: string }> };

/**
 * Records a lecturer's decision on a forwarded absence request via
 * `record_leave_lecturer_outcome`.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, id } = await context.params;
    const parsedId = leaveRequestIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw notFound();
    }

    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "leave-requests:outcome",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 60,
    });

    const rawBody = (await request.json().catch(() => null)) as unknown;
    const parsed = lecturerOutcomeSchema.safeParse(rawBody);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Choose a valid lecturer outcome.",
        toFieldErrors(parsed.error),
      );
    }

    const leaveRequest = await getLeaveRequestById(parsedId.data);

    if (!leaveRequest || leaveRequest.classId !== found.id) {
      throw notFound();
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "record_leave_lecturer_outcome" as never,
      {
        p_request_id: parsedId.data,
        p_outcome: parsed.data.outcome,
        p_note: parsed.data.note ?? null,
      } as never,
    );

    if (error) {
      throw new ApiError(
        400,
        "outcome_failed",
        "Could not record lecturer outcome.",
      );
    }

    return apiSuccess({
      outcome: data ?? parsed.data.outcome,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

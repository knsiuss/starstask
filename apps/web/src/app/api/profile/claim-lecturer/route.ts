import { z } from "zod";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const claimSchema = z.object({
  nidn: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "NIDN must be exactly 10 digits")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/**
 * Self-claim the lecturer persona.
 *
 * The RPC decides legitimacy entirely from the caller's confirmed auth email
 * domain (matched against `universities.institutional_domains`) and validates
 * only NIDN format when supplied. Clients cannot write
 * university_memberships directly, so this endpoint is the only manual claim
 * path; auto-activation runs at signup and at email confirmation inside
 * handle_new_user / handle_email_confirmed. Fails closed on every error.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "profile:claim-lecturer",
      identifier: session.user.id,
      limit: 10,
      windowSeconds: 900,
    });

    const body = await request.json().catch(() => ({}));
    const parsed = claimSchema.safeParse(body ?? {});

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the highlighted fields.",
        { nidn: parsed.error.issues[0]?.message ?? "Invalid NIDN." },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "claim_lecturer_persona" as never,
      { p_nidn: parsed.data.nidn ?? null } as never,
    );

    if (error) {
      const message =
        error.code === "42501" || error.message.includes("institutional")
          ? "Your account email domain is not registered as institutional for any active university. Ask the platform operator to enable your university first."
          : error.code === "22023"
            ? error.message
            : "Could not activate the lecturer persona. Try again.";

      throw new ApiError(422, "claim_failed", message);
    }

    return apiSuccess({ membershipId: data as unknown as string });
  } catch (error) {
    return handleRouteError(error);
  }
}

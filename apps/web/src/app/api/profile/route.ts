import { profileSettingsSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { getMyProfile, updateMyBio, updateMyProfile } from "@/lib/db/profiles";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_JSON_BYTES = 4 * 1024;

/**
 * Saves the editable part of the owner's profile: name, nickname, and bio.
 *
 * NIM and university are not accepted from the body. They are re-sent from the
 * stored profile because `update_my_profile` writes the whole row, and letting
 * the browser supply them would turn this endpoint into a way to rewrite an
 * institutional identifier.
 *
 * The owner always comes from the verified session, so one user can never
 * write another user's profile even if the payload says otherwise.
 */
export async function PATCH(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "profile:settings",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 3600,
    });

    const declaredLength = Number(request.headers.get("content-length") ?? "0");

    if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
      throw new ApiError(
        413,
        "payload_too_large",
        "The request body is too large.",
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new ApiError(
        400,
        "invalid_json",
        "The request body could not be read.",
      );
    }

    const parsed = profileSettingsSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const current = await getMyProfile();

    if (!current) {
      throw new ApiError(404, "profile_missing", "Your profile was not found.");
    }

    // `update_my_profile` writes full_name, nim, and university together and
    // rejects a null. A profile without them never finished onboarding, so the
    // honest answer is to send the student back through that flow.
    if (!current.nim || !current.university) {
      throw new ApiError(
        409,
        "onboarding_incomplete",
        "Finish setting up your profile before editing it.",
      );
    }

    const profile = await updateMyProfile({
      fullName: parsed.data.fullName,
      nickname: parsed.data.nickname,
      nim: current.nim,
      university: current.university,
      className: current.declaredClassName ?? undefined,
    });

    await updateMyBio({ bio: parsed.data.bio });

    return apiSuccess({ profile: { ...profile, bio: parsed.data.bio } });
  } catch (error) {
    return handleRouteError(error);
  }
}

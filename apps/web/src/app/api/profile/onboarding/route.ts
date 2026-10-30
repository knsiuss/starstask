import {
  profileOnboardingSchema,
  PROFILE_AVATAR_MAX_BYTES,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { saveOnboardingProfile } from "@/features/profile/profile-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The form is text plus one optional 2 MB photo; anything beyond that is
// rejected before the body is buffered.
const MAX_FORM_BYTES = PROFILE_AVATAR_MAX_BYTES + 64 * 1024;

function readText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/**
 * Saves the onboarding form for the signed-in user.
 *
 * Identity comes from the verified session, never from the payload, so one
 * user cannot write another user's profile. Private fields (full name, NIM) are
 * validated here and again by the database function that owns the write.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "profile:onboarding",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 300,
    });

    const declaredLength = Number(request.headers.get("content-length") ?? "0");

    if (declaredLength > MAX_FORM_BYTES) {
      throw new ApiError(
        413,
        "file_too_large",
        "The photo must be 2 MB or smaller.",
      );
    }

    const formData = await request.formData();
    const parsed = profileOnboardingSchema.safeParse({
      fullName: readText(formData.get("fullName")),
      nickname: readText(formData.get("nickname")),
      nim: readText(formData.get("nim")),
      university: readText(formData.get("university")),
      className: readText(formData.get("className")),
    });

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const photo = formData.get("avatar");
    const avatar = photo instanceof File && photo.size > 0 ? photo : null;

    const result = await saveOnboardingProfile(parsed.data, avatar);

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

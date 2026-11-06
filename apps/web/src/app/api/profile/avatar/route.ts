import { PROFILE_AVATAR_MAX_BYTES } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { assertUploadContentLength } from "@/lib/api/upload-limit";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { saveMyAvatar } from "@/features/profile/profile-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// One 2 MB photo plus a little form overhead; anything larger is refused before
// the body is buffered.
const MAX_FORM_BYTES = PROFILE_AVATAR_MAX_BYTES + 16 * 1024;

/**
 * Replaces the signed-in user's profile photo.
 *
 * The file is validated by signature, not by the declared MIME type, and the
 * storage key is derived from the session id, so an upload can only ever write
 * inside the caller's own folder.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "profile:avatar",
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

    // Bounded upload: refuse oversized/unlength'd bodies before buffering.
    assertUploadContentLength(request);

    const formData = await request.formData();
    const photo = formData.get("avatar");

    if (!(photo instanceof File) || photo.size === 0) {
      throw new ApiError(400, "invalid_file", "Choose a PNG or JPG image.");
    }

    const avatarUrl = await saveMyAvatar(photo);

    return apiSuccess({ avatarUrl });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { ApiError } from "@/lib/api/errors";
import { handleRouteError } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

/**
 * Starts (or resumes) a verification draft.
 *
 * Temporarily disabled (owner decision, 2026-10-29): representatives claim
 * access directly from the profile page. Requests that were already submitted
 * stay visible and decidable in the admin queue.
 */
export async function POST() {
  try {
    throw new ApiError(
      409,
      "verification_disabled",
      "Verification review is temporarily disabled. You can become a class representative directly from your profile page.",
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export const runtime = "nodejs";

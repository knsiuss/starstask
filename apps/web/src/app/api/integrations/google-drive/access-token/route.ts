import { apiError, apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { getValidDriveAccessToken } from "@/lib/db/google-drive-connections";

export const dynamic = "force-dynamic";

/**
 * Short-lived access token for the Picker. The token is returned only to
 * the signed-in owner over HTTPS, never stored in the browser, and the
 * Picker only sees files the user picks (drive.file scope).
 */
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return apiError(401, "unauthorized", "Sign in first.");
    }

    const accessToken = await getValidDriveAccessToken(session.user.id);

    return apiSuccess({ accessToken });
  } catch (error) {
    return handleRouteError(error);
  }
}

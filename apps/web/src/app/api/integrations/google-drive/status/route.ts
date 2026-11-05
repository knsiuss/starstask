import { apiError, apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { getDriveConnectionPublic } from "@/lib/db/google-drive-connections";
import { isGoogleDriveConfigured } from "@/lib/integrations/google/drive-config";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return apiError(401, "unauthorized", "Sign in to check Drive status.");
    }

    await enforceRateLimit({
      action: "integrations:google-drive:status",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const connection = await getDriveConnectionPublic(session.user.id);

    return apiSuccess({
      configured: isGoogleDriveConfigured(),
      connected: connection?.status === "connected",
      driveEmail: connection?.driveEmail ?? null,
      connectedAt: connection?.connectedAt ?? null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

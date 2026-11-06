import { ApiError, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { revokeDriveSubmission } from "@/lib/db/drive-submissions";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; submissionId: string }>;
};

/** Revokes the lecturer share link of one of the caller's own submissions. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "assignments:drive-submissions:revoke",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const { submissionId } = await context.params;

    await revokeDriveSubmission(submissionId, session.user.id);

    return apiSuccess({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

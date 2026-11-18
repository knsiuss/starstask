import { ApiError, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getOwnExportJob } from "@/lib/db/export-jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 15 * 60;

/** Polling endpoint for one queued export job (owner only). */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "exports:poll",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 60,
    });

    const { id } = await context.params;
    const job = await getOwnExportJob(id, session.user.id);

    if (!job) {
      throw new ApiError(404, "not_found", "Export not found.");
    }

    let downloadUrl: string | null = null;

    if (job.status === "done" && job.result_path) {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.storage
        .from("exports")
        .createSignedUrl(job.result_path, SIGNED_URL_TTL_SECONDS);

      if (error || !data) {
        throw new ApiError(503, "not_configured", "Could not load the file.");
      }

      downloadUrl = data.signedUrl;
    }

    return apiSuccess({
      id: job.id,
      kind: job.kind,
      status: job.status,
      error: job.error_category,
      downloadUrl,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

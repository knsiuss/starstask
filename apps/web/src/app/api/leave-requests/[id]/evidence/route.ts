import { leaveRequestIdSchema } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { uploadEvidence } from "@/features/leave/evidence-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Maximum accepted upload size, mirrored from the contract constant. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Uploads one supporting document.
 *
 * The bytes are validated by signature, not by the browser-supplied MIME type,
 * and stored under `{student_id}/{request_id}/` so the storage policy itself
 * prevents cross-user access. OCR runs afterwards as a best-effort step.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const { id } = await context.params;
    const parsedId = leaveRequestIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(
        404,
        "not_found",
        "That absence request was not found.",
      );
    }

    await enforceRateLimit({
      action: "leave-requests:evidence",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 60,
    });

    const declaredLength = Number(request.headers.get("content-length") ?? "0");

    if (declaredLength > MAX_UPLOAD_BYTES + 1024) {
      throw new ApiError(
        413,
        "file_too_large",
        "Each file must be 10 MB or smaller.",
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "invalid_file", "Choose a file to upload.");
    }

    const result = await uploadEvidence(parsedId.data, file);

    return apiSuccess(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

import {
  VERIFICATION_EVIDENCE_MAX_BYTES,
  verificationRequestIdSchema,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { uploadVerificationEvidence } from "@/features/verification/evidence-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Uploads one proof document into the private verification bucket.
 *
 * Bytes are validated by signature, not by the browser-supplied MIME type, and
 * stored under `{student_id}/{request_id}/` so the storage policy itself blocks
 * cross-user access.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const { id } = await context.params;
    const parsedId = verificationRequestIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(404, "not_found", "That request was not found.");
    }

    await enforceRateLimit({
      action: "verification:evidence",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 60,
    });

    const declaredLength = Number(request.headers.get("content-length") ?? "0");

    if (declaredLength > VERIFICATION_EVIDENCE_MAX_BYTES + 1024) {
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

    const result = await uploadVerificationEvidence(parsedId.data, file);

    return apiSuccess(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

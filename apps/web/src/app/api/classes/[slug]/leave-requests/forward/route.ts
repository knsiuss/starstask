import {
  leaveForwardingRequestSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { fileDownload, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { forwardLeaveRequests } from "@/features/leave/forwarding-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

const PDF_MIME_TYPE = "application/pdf";

/**
 * Builds the forwarding package and records it, then returns the file.
 *
 * The response is the generated PDF itself, so a successful download is also the
 * proof the operation completed. The `X-Starstask-Forwarding-Reference` header
 * carries the audit reference. Nothing here claims the report was emailed or
 * received — StarsTask hands the file to the admin to share.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const { slug } = await context.params;

    await enforceRateLimit({
      action: "leave-requests:forward",
      identifier: session.user.id,
      limit: 10,
      windowSeconds: 60,
    });

    const body = (await request.json()) as unknown;
    const parsed = leaveForwardingRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the forwarding details.",
        toFieldErrors(parsed.error),
      );
    }

    const result = await forwardLeaveRequests({
      classSlug: slug,
      requestIds: parsed.data.requestIds,
      recipientName: parsed.data.recipientName,
      recipientEmail: parsed.data.recipientEmail,
      reportFormat: parsed.data.reportFormat,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    const response = fileDownload(result.bytes, result.filename, PDF_MIME_TYPE);

    response.headers.set(
      "X-Starstask-Forwarding-Reference",
      result.forwardingReference,
    );
    response.headers.set(
      "X-Starstask-Request-Count",
      String(result.requestCount),
    );

    if (result.missing.length > 0) {
      // Surfaced as a header so the UI can warn without parsing the PDF.
      response.headers.set(
        "X-Starstask-Missing-Attachments",
        String(result.missing.length),
      );
    }

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}

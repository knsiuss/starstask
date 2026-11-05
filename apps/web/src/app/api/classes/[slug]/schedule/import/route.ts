import { ApiError, forbidden, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isFeatureEnabled } from "@/lib/config/features";
import { listClassSubjects } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { runOcr } from "@/lib/ocr";
import { parseScheduleText } from "@/lib/ocr/schedule-parse";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { matchScheduleRow } from "@/features/schedule/schedule-match";
import { requireClassMember } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Same ceiling as the leave-evidence upload. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Reads a timetable PDF and returns candidate slots matched to this
 * class's courses. Nothing is written here: the class confirms the rows
 * in a preview, and only the batch endpoint persists them.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    if (!isFeatureEnabled("ocr")) {
      throw forbidden();
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassMember(slug);

    await enforceRateLimit({
      action: "classes:schedule:import",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 3600,
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
      throw new ApiError(
        400,
        "invalid_file",
        "Choose a PDF or image file to upload.",
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Validate by signature, not by the browser-supplied MIME type.
    const isPdf =
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d;

    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng =
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;

    let mimeType: string;

    if (isPdf) {
      mimeType = "application/pdf";
    } else if (isJpeg) {
      mimeType = "image/jpeg";
    } else if (isPng) {
      mimeType = "image/png";
    } else {
      throw new ApiError(
        400,
        "invalid_file",
        "Only PDF, JPEG, or PNG files can be read automatically right now.",
      );
    }

    const { outcome } = await runOcr({
      bytes,
      mimeType,
    });

    if (outcome.status !== "succeeded") {
      throw new ApiError(
        422,
        "ocr_failed",
        outcome.status === "unsupported"
          ? "This PDF could not be read automatically. Only PDFs with a text layer are supported right now; add the slots manually instead."
          : "This PDF could not be read. Add the slots manually instead.",
      );
    }

    const parsed = parseScheduleText(outcome.text);

    if (parsed.rows.length === 0) {
      throw new ApiError(
        422,
        "no_rows_found",
        "No schedule rows could be read from this file. Check that it is a timetable table, or add the slots manually.",
      );
    }

    const subjects = await listClassSubjects(found.id);
    const rows = parsed.rows.map((row) => matchScheduleRow(row, subjects));

    return apiSuccess({
      rows,
      warnings: parsed.warnings,
      classSlug: found.slug,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

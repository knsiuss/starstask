import { ApiError } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isFeatureEnabled } from "@/lib/config/features";
import { getOfferingRoster } from "@/lib/db/academic-attendance";
import { requireClassPermission } from "@/lib/authz/class-permission";
import { requireServiceRoleClient } from "@/lib/authz/service-role";
import { isSupabaseConfigured } from "@/lib/env/public";
import { runOcr } from "@/lib/ocr";
import { parseAttendanceSheetText } from "@/lib/ocr/attendance-sheet-parse";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Same ceiling as the schedule import. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Reads a printed attendance sheet PDF (text layer only) and returns
 * candidate present flags matched by NIM. Nothing is written here:
 * the manager verifies the preview in the UI and only the bulk
 * records endpoint persists attendance.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw new ApiError(
        503,
        "service_unavailable",
        "Supabase is not configured.",
      );
    }

    if (!isFeatureEnabled("ocr")) {
      throw new ApiError(403, "forbidden", "Automatic reading is disabled.");
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassPermission(
      slug,
      "manage_attendance",
    );

    if (!found.universityId) {
      throw new ApiError(
        409,
        "class_unlinked",
        "This class is not linked to a university yet.",
      );
    }

    await enforceRateLimit({
      action: "classes:academic-attendance:paper-parse",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 3600,
    });

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "invalid_file", "Choose a PDF file to upload.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    if (bytes.length > MAX_UPLOAD_BYTES) {
      throw new ApiError(
        413,
        "file_too_large",
        "Each file must be 10 MB or smaller.",
      );
    }

    const isPdf =
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d;

    if (!isPdf) {
      throw new ApiError(
        400,
        "invalid_file",
        "Only PDF files can be read automatically right now. For photos, use the manual grid below.",
      );
    }

    const { outcome } = await runOcr({
      bytes,
      mimeType: "application/pdf",
    });

    if (outcome.status !== "succeeded") {
      throw new ApiError(
        422,
        "ocr_failed",
        outcome.status === "unsupported"
          ? "This PDF has no text layer (it looks scanned). Use the manual grid below for photos."
          : "This PDF could not be read. Use the manual grid below instead.",
      );
    }

    const meetingId = String(formData.get("meetingId") ?? "").trim();

    if (!meetingId) {
      throw new ApiError(
        400,
        "missing_meeting",
        "Select a meeting before parsing.",
      );
    }

    const service = requireServiceRoleClient();
    const meetingRow = await service
      .from("attendance_meetings")
      .select("id, offering_id")
      .eq("id", meetingId)
      .maybeSingle();

    if (!meetingRow.data) {
      throw new ApiError(404, "meeting_not_found", "Meeting not found.");
    }

    const roster = await getOfferingRoster(
      service,
      meetingRow.data.offering_id as string,
      found.universityId,
    );
    const hits = parseAttendanceSheetText(
      outcome.text,
      roster.map((row) => row.studentCode ?? "").filter(Boolean),
    );

    return apiSuccess({
      hits,
      warnings:
        hits.length === 0
          ? [
              "No NIM matched. Check that the PDF uses the same NIMs as the roster.",
            ]
          : [],
      classSlug: found.slug,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

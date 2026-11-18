import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { assertUploadContentLength } from "@/lib/api/upload-limit";
import { isSupabaseConfigured } from "@/lib/env/public";
import { aiVisionProvider } from "@/lib/ocr/ai-vision";
import { parseKrsText } from "@/lib/ocr/krs-parse";
import { pdfTextProvider } from "@/lib/ocr/pdf-text";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type DetectedFileType =
  | { kind: "pdf"; mimeType: "application/pdf" }
  | { kind: "image"; mimeType: "image/jpeg" | "image/png" | "image/webp" };

function detectFileType(bytes: Uint8Array): DetectedFileType | null {
  const isPdf =
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d;

  if (isPdf) {
    return { kind: "pdf", mimeType: "application/pdf" };
  }

  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;

  if (isJpeg) {
    return { kind: "image", mimeType: "image/jpeg" };
  }

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

  if (isPng) {
    return { kind: "image", mimeType: "image/png" };
  }

  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  if (isWebp) {
    return { kind: "image", mimeType: "image/webp" };
  }

  return null;
}

/**
 * Extracts course and schedule drafts from an uploaded KRS file in memory.
 * Nothing is persisted or logged here so personal student fields are never
 * written to storage.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "classes:import-krs:parse",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 3600,
    });

    assertUploadContentLength(request);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(
        400,
        "invalid_file",
        "Choose a PDF, PNG, JPEG, or WebP file to upload.",
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    if (bytes.length === 0) {
      throw new ApiError(400, "invalid_file", "The uploaded file is empty.");
    }

    if (bytes.length > MAX_UPLOAD_BYTES) {
      throw new ApiError(
        413,
        "file_too_large",
        "Each file must be 10 MB or smaller.",
      );
    }

    const detected = detectFileType(bytes);

    if (!detected) {
      throw new ApiError(
        400,
        "invalid_file",
        "Only PDF, PNG, JPEG, or WebP files are supported.",
      );
    }

    const outcome =
      detected.kind === "pdf"
        ? await pdfTextProvider.extract({
            bytes,
            mimeType: detected.mimeType,
          })
        : await aiVisionProvider.extract({
            bytes,
            mimeType: detected.mimeType,
          });

    if (outcome.status !== "succeeded") {
      const message =
        detected.kind === "pdf"
          ? outcome.status === "unsupported"
            ? "This PDF has no readable text layer (it looks scanned). Upload a screenshot or image instead, or enter your courses manually."
            : "This PDF could not be read. Try uploading a screenshot or enter your courses manually."
          : outcome.reason;

      throw new ApiError(422, "ocr_failed", message);
    }

    const parsed = parseKrsText(outcome.text);

    return apiSuccess(parsed);
  } catch (error) {
    return handleRouteError(error);
  }
}

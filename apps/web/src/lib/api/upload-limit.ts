"server-only";

import { ApiError } from "@/lib/api/errors";

/**
 * Bounded upload reading (QA-11).
 *
 * `content-length` alone is not trustworthy (chunked bodies omit it), so the
 * cap is enforced twice: a precheck that refuses obvious oversized requests
 * BEFORE the framework buffers the body, and a byte counter while reading.
 * Partial buffers are discarded — never a partial state.
 */

/** Whole-request body cap for attachment OCR/upload routes (file + form overhead). */
export const MAX_UPLOAD_BODY_BYTES = 11 * 1024 * 1024;

export function assertUploadContentLength(request: Request): void {
  const rawHeader = request.headers.get("content-length");

  if (!rawHeader) {
    throw new ApiError(
      411,
      "length_required",
      "Uploads must send a Content-Length header.",
    );
  }

  const declared = Number(rawHeader);

  if (!Number.isFinite(declared) || declared < 0) {
    throw new ApiError(400, "invalid_length", "Invalid Content-Length header.");
  }

  if (declared > MAX_UPLOAD_BODY_BYTES) {
    throw new ApiError(
      413,
      "file_too_large",
      "Each file must be 10 MB or smaller.",
    );
  }
}

/** Reads the request body, aborting the moment it exceeds the cap. */
export async function readBoundedBody(
  request: Request,
  maxBytes: number = MAX_UPLOAD_BODY_BYTES,
): Promise<Uint8Array> {
  const reader = request.body?.getReader();

  if (!reader) {
    throw new ApiError(400, "invalid_body", "Request body could not be read.");
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      total += value.byteLength;

      if (total > maxBytes) {
        await reader.cancel();
        throw new ApiError(
          413,
          "file_too_large",
          "Each file must be 10 MB or smaller.",
        );
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const all = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return all;
}

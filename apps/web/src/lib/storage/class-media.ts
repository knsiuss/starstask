import "server-only";

import { randomUUID } from "node:crypto";

import { matchesSignature, sanitizeFilename } from "@/lib/storage/attachments";

export const CLASS_MEDIA_BUCKET = "class-media";

/** Must stay in sync with `file_size_limit` on the `class-media` bucket. */
export const CLASS_MEDIA_MAX_BYTES = 4 * 1024 * 1024;

type AllowedImage = {
  mimeType: "image/png" | "image/jpeg";
  signatures: number[][];
};

const ALLOWED_EXTENSIONS: Record<string, AllowedImage> = {
  png: {
    mimeType: "image/png",
    signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  },
  jpg: {
    mimeType: "image/jpeg",
    signatures: [[0xff, 0xd8, 0xff]],
  },
  jpeg: {
    mimeType: "image/jpeg",
    signatures: [[0xff, 0xd8, 0xff]],
  },
};

export const CLASS_MEDIA_ACCEPTED_EXTENSIONS = Object.keys(ALLOWED_EXTENSIONS);

export type ValidatedClassImage = {
  mimeType: "image/png" | "image/jpeg";
  bytes: Uint8Array;
  objectName: string;
};

export type ClassImageValidationResult =
  { ok: true; value: ValidatedClassImage } | { ok: false; error: string };

/**
 * Validates a class image without trusting the browser.
 *
 * The extension picks the expected type and the leading bytes confirm it; the
 * declared MIME type is ignored, exactly as for profile avatars. Only PNG and
 * JPEG are accepted, matching the bucket's `allowed_mime_types`.
 */
export async function validateClassImage(
  file: File,
): Promise<ClassImageValidationResult> {
  if (file.size <= 0) {
    return { ok: false, error: "The image is empty." };
  }

  if (file.size > CLASS_MEDIA_MAX_BYTES) {
    return { ok: false, error: "The image must be 4 MB or smaller." };
  }

  const safeName = sanitizeFilename(file.name);
  const extension = safeName.split(".").pop()?.toLowerCase() ?? "";
  const allowed = ALLOWED_EXTENSIONS[extension];

  if (!allowed) {
    return { ok: false, error: "Use a PNG or JPG image." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (
    !allowed.signatures.some((signature) => matchesSignature(bytes, signature))
  ) {
    return { ok: false, error: `${safeName} is not a valid image.` };
  }

  return {
    ok: true,
    value: {
      mimeType: allowed.mimeType,
      bytes,
      objectName: `${randomUUID()}.${extension}`,
    },
  };
}

/**
 * Object key: `{class_id}/{uuid}.{ext}`.
 *
 * The first segment is the class id because the storage policy checks it
 * against the caller's class admin rows.
 */
export function buildClassMediaPath(
  classId: string,
  objectName: string,
): string {
  return `${classId}/${objectName}`;
}

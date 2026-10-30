import "server-only";

import { randomUUID } from "node:crypto";

import { PROFILE_AVATAR_MAX_BYTES } from "@starstask/contracts";

import { matchesSignature, sanitizeFilename } from "@/lib/storage/attachments";

export const AVATAR_BUCKET = "avatars";

type AllowedAvatarFile = {
  mimeType: "image/png" | "image/jpeg";
  signatures: number[][];
};

const ALLOWED_EXTENSIONS: Record<string, AllowedAvatarFile> = {
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

export const AVATAR_ACCEPTED_EXTENSIONS = Object.keys(ALLOWED_EXTENSIONS);

export type ValidatedAvatar = {
  mimeType: "image/png" | "image/jpeg";
  bytes: Uint8Array;
  objectName: string;
};

export type AvatarValidationResult =
  { ok: true; value: ValidatedAvatar } | { ok: false; error: string };

/**
 * Validates an avatar upload without trusting the browser.
 *
 * The extension picks the expected type and the leading bytes confirm it; the
 * declared MIME type is ignored. Only PNG and JPEG are accepted, matching the
 * bucket's `allowed_mime_types`.
 */
export async function validateAvatarFile(
  file: File,
): Promise<AvatarValidationResult> {
  if (file.size <= 0) {
    return { ok: false, error: "The image is empty." };
  }

  if (file.size > PROFILE_AVATAR_MAX_BYTES) {
    return { ok: false, error: "The photo must be 2 MB or smaller." };
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

/** Object key: `{owner_id}/{uuid}.{ext}`. */
export function buildAvatarStoragePath(
  userId: string,
  objectName: string,
): string {
  return `${userId}/${objectName}`;
}

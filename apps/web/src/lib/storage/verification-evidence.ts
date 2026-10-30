import "server-only";

import { randomUUID } from "node:crypto";

import {
  VERIFICATION_EVIDENCE_MAX_BYTES,
  VERIFICATION_EVIDENCE_MIME_TYPES,
  type VerificationEvidenceMimeType,
} from "@starstask/contracts";

import { matchesSignature, sanitizeFilename } from "@/lib/storage/attachments";

export const VERIFICATION_EVIDENCE_BUCKET = "verification-evidence";

/**
 * Five minutes, matching leave evidence.
 *
 * A class rep proof is personal data, so a leaked link should stop working
 * quickly rather than stay valid for the 15 minutes attachments use.
 */
export const VERIFICATION_SIGNED_URL_TTL_SECONDS = 300;

type AllowedEvidenceFile = {
  mimeType: VerificationEvidenceMimeType;
  signatures: number[][];
};

const ALLOWED_EXTENSIONS: Record<string, AllowedEvidenceFile> = {
  pdf: {
    mimeType: "application/pdf",
    signatures: [[0x25, 0x50, 0x44, 0x46, 0x2d]], // %PDF-
  },
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

export const VERIFICATION_EVIDENCE_ACCEPTED_EXTENSIONS =
  Object.keys(ALLOWED_EXTENSIONS);

export type ValidatedVerificationEvidence = {
  originalFilename: string;
  mimeType: VerificationEvidenceMimeType;
  fileSize: number;
  bytes: Uint8Array;
  objectName: string;
};

export type VerificationEvidenceValidationResult =
  | { ok: true; value: ValidatedVerificationEvidence }
  | { ok: false; error: string };

/**
 * Validates an uploaded proof file without trusting the browser.
 *
 * The extension picks the expected type, the leading bytes confirm it, and the
 * declared MIME type is ignored — a client controls that field. Passing this
 * check only proves the file is a readable PDF/JPG/PNG; it says nothing about
 * whether the document is genuine.
 */
export async function validateVerificationEvidenceFile(
  file: File,
): Promise<VerificationEvidenceValidationResult> {
  if (file.size <= 0) {
    return { ok: false, error: "The file is empty." };
  }

  if (file.size > VERIFICATION_EVIDENCE_MAX_BYTES) {
    return { ok: false, error: "Each file must be 10 MB or smaller." };
  }

  const safeName = sanitizeFilename(file.name);
  const extension = safeName.split(".").pop()?.toLowerCase() ?? "";
  const allowed = ALLOWED_EXTENSIONS[extension];

  if (!allowed) {
    return {
      ok: false,
      error: "Allowed file types: PDF, JPG, PNG.",
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (
    !allowed.signatures.some((signature) => matchesSignature(bytes, signature))
  ) {
    return {
      ok: false,
      error: `${safeName} does not look like a valid ${extension.toUpperCase()} file.`,
    };
  }

  return {
    ok: true,
    value: {
      originalFilename: safeName,
      mimeType: allowed.mimeType,
      fileSize: bytes.byteLength,
      bytes,
      objectName: `${randomUUID()}-${safeName}`,
    },
  };
}

/** Object key: `{student_id}/{request_id}/{uuid}-{filename}`. */
export function buildVerificationStoragePath(
  userId: string,
  requestId: string,
  objectName: string,
): string {
  return `${userId}/${requestId}/${objectName}`;
}

/** Whether a stored MIME type is one this feature accepts. */
export function isAllowedVerificationMime(
  value: string,
): value is VerificationEvidenceMimeType {
  return (VERIFICATION_EVIDENCE_MIME_TYPES as readonly string[]).includes(
    value,
  );
}

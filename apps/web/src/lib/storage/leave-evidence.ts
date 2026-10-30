import "server-only";

import { randomUUID } from "node:crypto";

import {
  LEAVE_EVIDENCE_MAX_BYTES,
  LEAVE_EVIDENCE_MIME_TYPES,
  type LeaveEvidenceMimeType,
} from "@starstask/contracts";

import { matchesSignature, sanitizeFilename } from "@/lib/storage/attachments";

export const LEAVE_EVIDENCE_BUCKET = "leave-evidence";

/**
 * Shorter than the 15 minutes used for assignment attachments.
 *
 * A leave document is medical evidence; a link that stops working after five
 * minutes limits the window in which a leaked URL is useful.
 */
export const EVIDENCE_SIGNED_URL_TTL_SECONDS = 300;

type AllowedEvidenceFile = {
  mimeType: LeaveEvidenceMimeType;
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

export const EVIDENCE_ACCEPTED_EXTENSIONS = Object.keys(ALLOWED_EXTENSIONS);

export type ValidatedEvidence = {
  originalFilename: string;
  mimeType: LeaveEvidenceMimeType;
  fileSize: number;
  bytes: Uint8Array;
  objectName: string;
};

export type EvidenceValidationResult =
  { ok: true; value: ValidatedEvidence } | { ok: false; error: string };

/**
 * Validates an evidence upload without trusting the browser.
 *
 * The extension decides the expected type, the leading bytes confirm it, and the
 * declared MIME type is ignored entirely — a client can send anything in that
 * field. This mirrors the assignment-attachment check so both behave the same.
 */
export async function validateEvidenceFile(
  file: File,
): Promise<EvidenceValidationResult> {
  if (file.size <= 0) {
    return { ok: false, error: "The file is empty." };
  }

  if (file.size > LEAVE_EVIDENCE_MAX_BYTES) {
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
export function buildEvidenceStoragePath(
  userId: string,
  requestId: string,
  objectName: string,
): string {
  return `${userId}/${requestId}/${objectName}`;
}

/** Whether a stored MIME type is one this feature accepts. */
export function isAllowedEvidenceMime(
  value: string,
): value is LeaveEvidenceMimeType {
  return (LEAVE_EVIDENCE_MIME_TYPES as readonly string[]).includes(value);
}

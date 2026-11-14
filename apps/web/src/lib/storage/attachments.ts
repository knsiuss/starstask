import "server-only";

import { randomUUID } from "node:crypto";

import {
  ASSIGNMENT_ATTACHMENT_MAX_BYTES,
  ASSIGNMENT_ATTACHMENTS_MAX,
} from "@starstask/contracts";

export { isInlinePreviewable } from "@/lib/storage/attachment-preview";

export const ATTACHMENT_BUCKET = "assignment-attachments";
export const SIGNED_URL_TTL_SECONDS = 15 * 60;

type AllowedFile = {
  mimeType: string;
  signatures: number[][];
};

const ALLOWED_EXTENSIONS: Record<string, AllowedFile> = {
  pdf: {
    mimeType: "application/pdf",
    signatures: [[0x25, 0x50, 0x44, 0x46, 0x2d]], // %PDF-
  },
  docx: {
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    signatures: [
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
    ],
  },
  pptx: {
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    signatures: [
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
    ],
  },
  xlsx: {
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    signatures: [
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
    ],
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
  csv: {
    mimeType: "text/csv",
    signatures: [],
  },
  ipynb: {
    mimeType: "application/json",
    signatures: [],
  },
  txt: {
    mimeType: "text/plain",
    signatures: [],
  },
  md: {
    mimeType: "text/markdown",
    signatures: [],
  },
  json: {
    mimeType: "application/json",
    signatures: [],
  },
  py: {
    mimeType: "text/x-python",
    signatures: [],
  },
  js: {
    mimeType: "text/javascript",
    signatures: [],
  },
  ts: {
    mimeType: "text/typescript",
    signatures: [],
  },
  tsx: {
    mimeType: "text/typescript",
    signatures: [],
  },
  zip: {
    mimeType: "application/zip",
    signatures: [
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
    ],
  },
  mp4: {
    mimeType: "video/mp4",
    signatures: [],
  },
  mp3: {
    mimeType: "audio/mpeg",
    signatures: [],
  },
};

export const ACCEPTED_FILE_EXTENSIONS = Object.keys(ALLOWED_EXTENSIONS);

export type ValidatedAttachment = {
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  bytes: Uint8Array;
  objectName: string;
};

export type AttachmentValidationResult =
  { ok: true; value: ValidatedAttachment } | { ok: false; error: string };

/**
 * Validates one uploaded file without trusting the browser.
 *
 * The MIME type is derived from the extension, then confirmed against the file
 * signature. The original filename is reduced to a safe basename for display;
 * the stored object name gets a random prefix so uploads can never overwrite
 * each other.
 */
export async function validateAttachmentFile(
  file: File,
): Promise<AttachmentValidationResult> {
  if (file.size <= 0) {
    return { ok: false, error: "The file is empty." };
  }

  if (file.size > ASSIGNMENT_ATTACHMENT_MAX_BYTES) {
    return { ok: false, error: "Each file must be 10 MB or smaller." };
  }

  const safeName = sanitizeFilename(file.name);
  const extension = safeName.split(".").pop()?.toLowerCase() ?? "";
  const allowed = ALLOWED_EXTENSIONS[extension];

  if (!allowed) {
    return {
      ok: false,
      error:
        "Allowed file types: PDF, DOCX, PPTX, XLSX, PNG, JPG, CSV, IPYNB, TXT, MD, JSON, PY, JS, TS, ZIP, MP4, MP3.",
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const isTextLike = allowed.signatures.length === 0;

  if (isTextLike && hasHtmlScript(bytes)) {
    return {
      ok: false,
      error: `${safeName} contains inline HTML or JavaScript, which is not allowed.`,
    };
  }

  if (
    !isTextLike &&
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

export function assertAttachmentCount(count: number): string | null {
  return count > ASSIGNMENT_ATTACHMENTS_MAX
    ? `You can attach at most ${ASSIGNMENT_ATTACHMENTS_MAX} files.`
    : null;
}

/** Builds the storage key: {owner_id}/{assignment_id}/{uuid}-{safe_filename}. */
export function buildStoragePath(
  userId: string,
  assignmentId: string,
  objectName: string,
): string {
  return `${userId}/${assignmentId}/${objectName}`;
}

/** Reduces any filename to a safe basename for display and storage keys. */
export function sanitizeFilename(rawName: string): string {
  const basename = rawName.split(/[\\/]/).pop() ?? "attachment";
  const cleaned = basename
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return cleaned.length > 0 ? cleaned : "attachment";
}

/** Compares a file's leading bytes against a known signature. */
export function matchesSignature(
  bytes: Uint8Array,
  signature: number[],
): boolean {
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => bytes[index] === byte);
}

const HTML_SCRIPT_PATTERN = new RegExp(
  "^\s*(<!doctype html|<html|<script|<iframe|<svg|<meta)|<script[\s>]|</script>|javascript:|on(load|error|click|focus)\s*=",
  "i",
);

/**
 * Text-like files may embed the same markup as an HTML attachment; the web
 * serves these only via forced `Content-Disposition: attachment`, but a
 * direct download must still never double as a phishing page. Reject before
 * the object is ever written.
 */
export function hasHtmlScript(bytes: Uint8Array): boolean {
  if (bytes.length === 0) {
    return false;
  }

  const decoder = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });
  const sample = decoder.decode(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)));

  return HTML_SCRIPT_PATTERN.test(sample);
}

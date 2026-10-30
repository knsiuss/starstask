import { describe, expect, it } from "vitest";

import { VERIFICATION_EVIDENCE_MAX_BYTES } from "@starstask/contracts";

import {
  buildVerificationStoragePath,
  isAllowedVerificationMime,
  validateVerificationEvidenceFile,
} from "@/lib/storage/verification-evidence";

/**
 * Upload validation is the only barrier between a browser and a private
 * bucket, so these tests take the hostile paths: a lying MIME type, a renamed
 * executable, an oversized file, and a path-traversal filename.
 */

function fileWith(
  bytes: number[] | Uint8Array,
  name: string,
  type = "application/octet-stream",
) {
  // Copy into a fresh buffer so the File part is always ArrayBuffer-backed.
  const copy = new Uint8Array(Array.from(bytes));

  return new File([copy.buffer], name, { type });
}

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const ELF_HEADER = [0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00];

describe("validateVerificationEvidenceFile", () => {
  it("accepts a PDF and derives the type from its bytes", async () => {
    const result = await validateVerificationEvidenceFile(
      fileWith(PDF_HEADER, "surat-ketua.pdf"),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mimeType).toBe("application/pdf");
      expect(result.value.originalFilename).toBe("surat-ketua.pdf");
      expect(result.value.objectName).toContain("surat-ketua.pdf");
    }
  });

  it("accepts PNG and JPG images", async () => {
    const png = await validateVerificationEvidenceFile(
      fileWith(PNG_HEADER, "screenshot.png"),
    );
    const jpg = await validateVerificationEvidenceFile(
      fileWith(JPG_HEADER, "photo.jpg"),
    );

    expect(png.ok).toBe(true);
    expect(jpg.ok).toBe(true);
  });

  it("ignores a declared MIME type that disagrees with the bytes", async () => {
    // A client can send any Content-Type; the leading bytes decide.
    const result = await validateVerificationEvidenceFile(
      fileWith(PDF_HEADER, "letter.pdf", "image/png"),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mimeType).toBe("application/pdf");
    }
  });

  it("rejects a renamed executable", async () => {
    const result = await validateVerificationEvidenceFile(
      fileWith(ELF_HEADER, "proof.pdf"),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("does not look like a valid PDF");
    }
  });

  it("rejects an unsupported extension", async () => {
    const result = await validateVerificationEvidenceFile(
      fileWith(PDF_HEADER, "proof.docx"),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("PDF, JPG, PNG");
    }
  });

  it("rejects an empty file", async () => {
    const result = await validateVerificationEvidenceFile(
      fileWith([], "empty.pdf"),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects a file over the configured limit", async () => {
    const oversized = new Uint8Array(VERIFICATION_EVIDENCE_MAX_BYTES + 1);
    oversized.set(PDF_HEADER);

    const result = await validateVerificationEvidenceFile(
      fileWith(oversized, "big.pdf"),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("10 MB");
    }
  });

  it("strips a path from the filename", async () => {
    const result = await validateVerificationEvidenceFile(
      fileWith(PDF_HEADER, "../../etc/passwd.pdf"),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.originalFilename).toBe("passwd.pdf");
      expect(result.value.originalFilename).not.toContain("/");
      expect(result.value.objectName).not.toContain("..");
    }
  });

  it("gives two uploads of the same file different object names", async () => {
    const first = await validateVerificationEvidenceFile(
      fileWith(PDF_HEADER, "a.pdf"),
    );
    const second = await validateVerificationEvidenceFile(
      fileWith(PDF_HEADER, "a.pdf"),
    );

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.objectName).not.toBe(second.value.objectName);
    }
  });
});

describe("buildVerificationStoragePath", () => {
  it("scopes the object under the student and the request", () => {
    const path = buildVerificationStoragePath(
      "6f1a6d3e-0000-4000-8000-000000000001",
      "6f1a6d3e-0000-4000-8000-000000000002",
      "abc-surat.pdf",
    );

    expect(path).toBe(
      "6f1a6d3e-0000-4000-8000-000000000001/6f1a6d3e-0000-4000-8000-000000000002/abc-surat.pdf",
    );
  });
});

describe("isAllowedVerificationMime", () => {
  it("accepts only the three documented types", () => {
    expect(isAllowedVerificationMime("application/pdf")).toBe(true);
    expect(isAllowedVerificationMime("image/png")).toBe(true);
    expect(isAllowedVerificationMime("image/jpeg")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isAllowedVerificationMime("image/gif")).toBe(false);
    expect(isAllowedVerificationMime("text/html")).toBe(false);
    expect(isAllowedVerificationMime("application/octet-stream")).toBe(false);
  });
});

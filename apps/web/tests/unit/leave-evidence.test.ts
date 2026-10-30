import { describe, expect, it } from "vitest";

import {
  buildEvidenceStoragePath,
  isAllowedEvidenceMime,
  validateEvidenceFile,
} from "@/lib/storage/leave-evidence";
import { LEAVE_EVIDENCE_MAX_BYTES } from "@starstask/contracts";

/**
 * Evidence validation is the only thing standing between a browser and a private
 * bucket, so these tests cover the paths a hostile client would take: a lying
 * MIME type, a renamed executable, and an oversized file.
 */

function fileWith(
  bytes: number[] | Uint8Array,
  name: string,
  type = "application/octet-stream",
) {
  // Copied into a fresh view so the File constructor gets a plain ArrayBuffer
  // rather than a possibly shared one.
  return new File([new Uint8Array(bytes)], name, { type });
}

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const ELF_HEADER = [0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00];

describe("validateEvidenceFile", () => {
  it("accepts a PDF and derives its type from the bytes", async () => {
    const result = await validateEvidenceFile(
      fileWith(PDF_HEADER, "surat.pdf"),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mimeType).toBe("application/pdf");
      expect(result.value.originalFilename).toBe("surat.pdf");
    }
  });

  it("accepts PNG and JPG images", async () => {
    const png = await validateEvidenceFile(fileWith(PNG_HEADER, "scan.png"));
    const jpg = await validateEvidenceFile(fileWith(JPG_HEADER, "photo.jpg"));

    expect(png.ok).toBe(true);
    expect(jpg.ok).toBe(true);
  });

  it("ignores a declared MIME type that disagrees with the bytes", async () => {
    // A client can send anything in Content-Type, so the bytes decide.
    const result = await validateEvidenceFile(
      fileWith(PDF_HEADER, "letter.pdf", "image/png"),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mimeType).toBe("application/pdf");
    }
  });

  it("rejects a renamed executable", async () => {
    const result = await validateEvidenceFile(
      fileWith(ELF_HEADER, "notes.pdf"),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("does not look like a valid PDF");
    }
  });

  it("rejects an unsupported extension", async () => {
    const result = await validateEvidenceFile(
      fileWith(PDF_HEADER, "notes.docx"),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("PDF, JPG, PNG");
    }
  });

  it("rejects an empty file", async () => {
    const result = await validateEvidenceFile(fileWith([], "empty.pdf"));

    expect(result.ok).toBe(false);
  });

  it("rejects a file over the configured limit", async () => {
    const oversized = new Uint8Array(LEAVE_EVIDENCE_MAX_BYTES + 1);
    oversized.set(PDF_HEADER);

    const result = await validateEvidenceFile(fileWith(oversized, "big.pdf"));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("10 MB");
    }
  });

  it("strips a path from the filename", async () => {
    const result = await validateEvidenceFile(
      fileWith(PDF_HEADER, "../../etc/passwd.pdf"),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.originalFilename).toBe("passwd.pdf");
      expect(result.value.originalFilename).not.toContain("/");
      expect(result.value.objectName).not.toContain("..");
    }
  });

  it("generates a storage key that cannot collide", async () => {
    const first = await validateEvidenceFile(fileWith(PDF_HEADER, "a.pdf"));
    const second = await validateEvidenceFile(fileWith(PDF_HEADER, "a.pdf"));

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      // Two uploads of the same name must not overwrite each other.
      expect(first.value.objectName).not.toBe(second.value.objectName);
    }
  });
});

describe("buildEvidenceStoragePath", () => {
  it("scopes the object under the student and the request", () => {
    const path = buildEvidenceStoragePath(
      "6f1a6d3e-0000-4000-8000-000000000001",
      "6f1a6d3e-0000-4000-8000-000000000002",
      "abc-surat.pdf",
    );

    expect(path).toBe(
      "6f1a6d3e-0000-4000-8000-000000000001/6f1a6d3e-0000-4000-8000-000000000002/abc-surat.pdf",
    );
  });
});

describe("isAllowedEvidenceMime", () => {
  it("accepts only the three documented types", () => {
    expect(isAllowedEvidenceMime("application/pdf")).toBe(true);
    expect(isAllowedEvidenceMime("image/png")).toBe(true);
    expect(isAllowedEvidenceMime("image/jpeg")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isAllowedEvidenceMime("image/gif")).toBe(false);
    expect(isAllowedEvidenceMime("text/html")).toBe(false);
    expect(isAllowedEvidenceMime("application/octet-stream")).toBe(false);
  });
});

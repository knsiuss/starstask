import { describe, expect, it } from "vitest";

import {
  assertAttachmentCount,
  buildStoragePath,
  validateAttachmentFile,
} from "@/lib/storage/attachments";

function fileWith(
  bytes: number[],
  name: string,
  type = "application/octet-stream",
) {
  return new File([new Uint8Array(bytes)], name, { type });
}

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
const ZIP_HEADER = [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];

describe("validateAttachmentFile", () => {
  it("accepts a real PDF signature", async () => {
    const result = await validateAttachmentFile(
      fileWith(PDF_HEADER, "brief.pdf"),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mimeType).toBe("application/pdf");
      expect(result.value.objectName.endsWith("-brief.pdf")).toBe(true);
    }
  });

  it("accepts the OOXML zip signature for docx", async () => {
    const result = await validateAttachmentFile(
      fileWith(ZIP_HEADER, "notes.docx"),
    );

    expect(result.ok).toBe(true);
  });

  it("accepts PNG and JPG images", async () => {
    await expect(
      validateAttachmentFile(fileWith(PNG_HEADER, "scan.png")),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      validateAttachmentFile(fileWith(JPG_HEADER, "photo.jpg")),
    ).resolves.toMatchObject({ ok: true });
  });

  it("rejects an unsupported extension even with a plausible MIME type", async () => {
    const result = await validateAttachmentFile(
      fileWith(PDF_HEADER, "payload.exe", "application/pdf"),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects a file whose bytes do not match its extension", async () => {
    const result = await validateAttachmentFile(
      fileWith([0x4d, 0x5a, 0x90, 0x00], "fake.pdf"),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("does not look like");
    }
  });

  it("rejects an empty file", async () => {
    const result = await validateAttachmentFile(fileWith([], "empty.pdf"));

    expect(result.ok).toBe(false);
  });

  it("rejects a file larger than 10 MB", async () => {
    // Put a valid signature first so only the size check can reject it.
    const bytes = new Uint8Array(10 * 1024 * 1024 + 1);
    bytes.set(PDF_HEADER, 0);
    const result = await validateAttachmentFile(new File([bytes], "big.pdf"));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("10 MB");
    }
  });

  it("strips directory components from the original filename", async () => {
    const result = await validateAttachmentFile(
      fileWith(PDF_HEADER, "../../etc/passwd.pdf"),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.originalFilename).toBe("passwd.pdf");
    }
  });
});

describe("assertAttachmentCount", () => {
  it("allows up to three files", () => {
    expect(assertAttachmentCount(3)).toBeNull();
  });

  it("rejects a fourth file", () => {
    expect(assertAttachmentCount(4)).toContain("at most 3");
  });
});

describe("buildStoragePath", () => {
  it("prefixes the object with owner and assignment ids", () => {
    expect(buildStoragePath("user-1", "assignment-1", "file.pdf")).toBe(
      "user-1/assignment-1/file.pdf",
    );
  });
});

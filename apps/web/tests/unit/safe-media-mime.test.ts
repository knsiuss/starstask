import { describe, expect, it } from "vitest";

import { sanitizePeerMediaMimeType } from "@/components/messages/safe-media-mime";

describe("sanitizePeerMediaMimeType", () => {
  it.each([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "audio/mpeg",
    "audio/ogg",
    "audio/webm",
    "audio/wav",
    "application/pdf",
    "application/zip",
    "text/plain",
  ])("allows safe MIME type %s", (mimeType) => {
    expect(sanitizePeerMediaMimeType(mimeType)).toBe(mimeType);
  });

  it("normalizes uppercase and MIME parameters on allowlisted types", () => {
    expect(sanitizePeerMediaMimeType("AUDIO/WEBM; codecs=opus")).toBe(
      "audio/webm",
    );
    expect(sanitizePeerMediaMimeType(" Image/PNG ; charset=utf-8 ")).toBe(
      "image/png",
    );
  });

  it.each([
    "text/html",
    "text/html; charset=utf-8",
    "image/svg+xml",
    "application/javascript",
    "text/javascript",
    "application/xhtml+xml",
    "application/octet-stream",
    "",
    null,
    undefined,
  ])("falls back to application/octet-stream for %s", (mimeType) => {
    expect(sanitizePeerMediaMimeType(mimeType)).toBe(
      "application/octet-stream",
    );
  });
});

const SAFE_PEER_MEDIA_MIME_TYPES = new Set([
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
]);

/**
 * Restricts peer-supplied attachment MIME types to a safe allowlist before
 * constructing a `Blob` or deciding inline preview rendering. Active content
 * types such as `text/html` and `image/svg+xml` fall back to
 * `application/octet-stream`.
 */
export function sanitizePeerMediaMimeType(
  mimeType: string | null | undefined,
): string {
  if (!mimeType) {
    return "application/octet-stream";
  }

  const baseType = mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? "";

  return SAFE_PEER_MEDIA_MIME_TYPES.has(baseType)
    ? baseType
    : "application/octet-stream";
}

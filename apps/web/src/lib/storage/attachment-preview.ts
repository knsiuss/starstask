/** Only formats the browser can render safely get an inline preview. */
export function isInlinePreviewable(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

const numberFormatter = new Intl.NumberFormat("en-US");

export function formatCount(value: number): string {
  return numberFormatter.format(value);
}

/** Truncates at a word boundary so cards never cut a word in half. */
export function excerpt(text: string, maxLength = 180): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sliced = normalized.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  const cut = lastSpace > maxLength * 0.6 ? sliced.slice(0, lastSpace) : sliced;

  return `${cut.trimEnd()}...`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function pluralize(
  count: number,
  singular: string,
  plural?: string,
): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

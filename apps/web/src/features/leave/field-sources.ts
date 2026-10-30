import {
  leaveFieldSourcesSchema,
  leaveOcrSuggestionSchema,
  type LeaveFieldSource,
  type LeaveOcrSuggestion,
} from "@starstask/contracts";

import type { Json } from "@/types/database";

/**
 * Reads the `field_sources` column.
 *
 * The column is free-form `jsonb`, so the value is re-validated here rather than
 * trusted. Anything unrecognised is dropped: an unknown source would otherwise
 * have to be labelled as something, and labelling a guess as confirmed is the
 * one thing this must never do.
 */
export function readFieldSources(
  value: Json,
): Record<string, LeaveFieldSource> {
  const parsed = leaveFieldSourcesSchema.safeParse(value);
  const sources: Record<string, LeaveFieldSource> = {};

  if (!parsed.success) {
    return sources;
  }

  for (const [field, source] of Object.entries(parsed.data)) {
    if (source) {
      sources[field] = source;
    }
  }

  return sources;
}

/** Reads a stored OCR result, or null when nothing usable was recorded. */
export function readOcrSuggestion(
  value: Json | null,
): LeaveOcrSuggestion | null {
  if (!value) {
    return null;
  }

  const parsed = leaveOcrSuggestionSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

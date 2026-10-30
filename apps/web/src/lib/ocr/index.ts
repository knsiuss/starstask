import "server-only";

import { parseOcrText } from "./parse";
import { pdfTextProvider } from "./pdf-text";
import type { OcrOutcome, OcrProvider } from "./types";

export { parseOcrText } from "./parse";
export { detectDocumentType, findDates, toIsoDate } from "./parse";
export type { OcrOutcome, OcrProvider } from "./types";

/**
 * Provider registry.
 *
 * Adding an engine means adding a file here and one entry below. The rest of the
 * application only ever talks to `runOcr`, so swapping providers never touches a
 * route, a page, or a database function.
 */
const PROVIDERS: Record<string, OcrProvider> = {
  "pdf-text": pdfTextProvider,
};

export const DEFAULT_OCR_PROVIDER = "pdf-text";

/**
 * Resolves the configured provider.
 *
 * `OCR_PROVIDER=disabled` turns OCR off entirely, which is the supported way to
 * run without it. An unknown value is treated as disabled rather than silently
 * falling back, so a typo cannot quietly change behaviour.
 */
export function resolveOcrProvider(): OcrProvider | null {
  const configured = (process.env.OCR_PROVIDER ?? DEFAULT_OCR_PROVIDER)
    .trim()
    .toLowerCase();

  if (configured === "" || configured === "disabled" || configured === "none") {
    return null;
  }

  return PROVIDERS[configured] ?? null;
}

export type OcrRunResult = {
  outcome: OcrOutcome;
  /** Parsed suggestions, empty when nothing could be read. */
  suggestion: ReturnType<typeof parseOcrText>;
};

/**
 * Runs OCR on one file and parses the result.
 *
 * Never throws: a failure is reported as an outcome so the caller can record it
 * and still let the student type the values by hand.
 */
export async function runOcr(input: {
  bytes: Uint8Array;
  mimeType: string;
}): Promise<OcrRunResult> {
  const provider = resolveOcrProvider();

  if (!provider) {
    return {
      outcome: {
        status: "unsupported",
        provider: "disabled",
        reason: "OCR is not enabled on this deployment.",
      },
      suggestion: {},
    };
  }

  if (!provider.supports(input.mimeType)) {
    return {
      outcome: {
        status: "unsupported",
        provider: provider.name,
        reason: "Only PDF documents can be read automatically right now.",
      },
      suggestion: {},
    };
  }

  const outcome = await provider.extract(input);

  if (outcome.status !== "succeeded") {
    return { outcome, suggestion: {} };
  }

  return { outcome, suggestion: parseOcrText(outcome.text) };
}

import "server-only";

/**
 * OCR provider contract.
 *
 * OCR is an optional assistant here. A provider only ever returns text; it never
 * decides anything, never writes to a leave request, and never blocks manual
 * entry. Swapping providers means adding a file and one line in `resolveProvider`.
 */

export type OcrOutcome =
  | { status: "succeeded"; provider: string; text: string }
  | { status: "unsupported"; provider: string; reason: string }
  | { status: "failed"; provider: string; reason: string };

export type OcrInput = {
  bytes: Uint8Array;
  mimeType: string;
};

export type OcrProvider = {
  name: string;
  /** Whether this provider can attempt the given type at all. */
  supports(mimeType: string): boolean;
  extract(input: OcrInput): Promise<OcrOutcome>;
};

/** Below this many characters a PDF is treated as scanned, not textual. */
export const MIN_TEXT_LENGTH = 24;

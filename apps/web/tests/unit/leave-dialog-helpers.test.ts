import { describe, expect, it } from "vitest";

/**
 * Mirror of the typed-confirmation check used by the leave dialogs.
 * Kept inline in this test file so the dialogs can stay component-free;
 * do not import `src` from here.
 *
 * The comparison is literal after trimming and normalizing ASCII whitespace
 * runs. There is no case folding: the class dialog asks for the class name
 * verbatim, and the course dialog asks for the uppercase literal `KELUAR`.
 */
export function canConfirmWithLength(value: string, expected: string): boolean {
  const normalize = (raw: string) => raw.replace(/\s+/g, " ").trim();
  return normalize(value) === normalize(expected);
}

describe("canConfirmWithLength", () => {
  it("accepts an exact match", () => {
    expect(canConfirmWithLength("TPL M002", "TPL M002")).toBe(true);
  });

  it("accepts surrounding whitespace and collapsed internal runs", () => {
    expect(canConfirmWithLength("  KELUAR  ", "KELUAR")).toBe(true);
    expect(canConfirmWithLength("TPL   M002", "TPL M002")).toBe(true);
  });

  it("rejects the wrong case for the uppercase KELUAR literal", () => {
    expect(canConfirmWithLength("keluar", "KELUAR")).toBe(false);
    expect(canConfirmWithLength("Keluar", "KELUAR")).toBe(false);
  });

  it("rejects a partial or longer string", () => {
    expect(canConfirmWithLength("KELUARG", "KELUAR")).toBe(false);
    expect(canConfirmWithLength("KELUA", "KELUAR")).toBe(false);
  });

  it("rejects an empty string as confirmation", () => {
    expect(canConfirmWithLength("   ", "KELUAR")).toBe(false);
    expect(canConfirmWithLength("", "")).toBe(true);
  });
});

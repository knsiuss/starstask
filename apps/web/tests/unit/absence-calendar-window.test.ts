import { describe, expect, it } from "vitest";

import { dateSpanOverlapsWindow } from "@starstask/shared";

/**
 * Absence requests are date-only, so they are placed on the calendar with an
 * overlap test rather than an instant comparison. The edge cases below are the
 * ones that actually bite: a request that started before the visible week, and
 * a single-day request with no end date.
 */
describe("dateSpanOverlapsWindow", () => {
  const week = { startKey: "2026-10-26", endKey: "2026-11-01" };

  it("matches a single-day request inside the window", () => {
    expect(dateSpanOverlapsWindow("2026-10-29", null, week)).toBe(true);
  });

  it("matches a multi-day request that starts before the window", () => {
    expect(dateSpanOverlapsWindow("2026-10-24", "2026-10-28", week)).toBe(true);
  });

  it("matches a multi-day request that ends after the window", () => {
    expect(dateSpanOverlapsWindow("2026-10-31", "2026-11-04", week)).toBe(true);
  });

  it("matches a request that covers the whole window", () => {
    expect(dateSpanOverlapsWindow("2026-10-01", "2026-11-30", week)).toBe(true);
  });

  it("treats the first and last day of the window as inside", () => {
    expect(dateSpanOverlapsWindow("2026-10-26", null, week)).toBe(true);
    expect(dateSpanOverlapsWindow("2026-11-01", null, week)).toBe(true);
  });

  it("rejects a request that ended before the window", () => {
    expect(dateSpanOverlapsWindow("2026-10-20", "2026-10-25", week)).toBe(
      false,
    );
  });

  it("rejects a request that starts after the window", () => {
    expect(dateSpanOverlapsWindow("2026-11-02", "2026-11-03", week)).toBe(
      false,
    );
  });

  it("falls back to the start date when the end date is missing", () => {
    expect(dateSpanOverlapsWindow("2026-11-02", null, week)).toBe(false);
    expect(dateSpanOverlapsWindow("2026-10-25", null, week)).toBe(false);
  });
});

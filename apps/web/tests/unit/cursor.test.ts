import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "@/lib/db/cursor";

describe("cursor helpers", () => {
  it("round-trips a timestamp cursor", () => {
    const cursor = encodeCursor("2026-11-05T12:00:00.123456+00:00");

    expect(decodeCursor(cursor)).toBe("2026-11-05T12:00:00.123456+00:00");
  });

  it("treats missing or malformed cursors as no cursor", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("not-a-date")).toBeNull();
  });
});

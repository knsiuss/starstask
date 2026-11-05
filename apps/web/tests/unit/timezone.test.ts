import { describe, expect, it } from "vitest";

import {
  formatInTimeZone,
  formatTimeWindow,
  resolveTimeZone,
  weekdayName,
} from "@/lib/utils/timezone";

describe("resolveTimeZone", () => {
  it("keeps a valid IANA timezone", () => {
    expect(resolveTimeZone("Asia/Jakarta")).toBe("Asia/Jakarta");
  });

  it("falls back to UTC for missing input", () => {
    expect(resolveTimeZone(null)).toBe("UTC");
    expect(resolveTimeZone(undefined)).toBe("UTC");
    expect(resolveTimeZone("")).toBe("UTC");
  });

  it("falls back to UTC for an invalid timezone", () => {
    expect(resolveTimeZone("Not/AZone")).toBe("UTC");
  });
});

describe("formatInTimeZone", () => {
  it("renders the instant in the requested timezone with the zone label", () => {
    // 2026-01-15T00:30:00Z is 07:30 in Jakarta (UTC+7, no DST).
    expect(formatInTimeZone("2026-01-15T00:30:00Z", "Asia/Jakarta")).toBe(
      "15/01/2026, 07:30 (Asia/Jakarta)",
    );
  });

  it("returns an em dash for an unparseable instant", () => {
    expect(formatInTimeZone("not-a-date", "Asia/Jakarta")).toBe("—");
  });
});

describe("weekdayName", () => {
  it("maps ISO weekdays 1-7", () => {
    expect(weekdayName(1)).toBe("Monday");
    expect(weekdayName(7)).toBe("Sunday");
  });

  it("labels out-of-range values instead of crashing", () => {
    expect(weekdayName(0)).toBe("Day 0");
  });
});

describe("formatTimeWindow", () => {
  it("trims time values to HH:MM", () => {
    expect(formatTimeWindow("09:00:00", "10:30:00")).toBe("09:00–10:30");
  });
});

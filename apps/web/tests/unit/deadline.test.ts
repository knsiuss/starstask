import { describe, expect, it } from "vitest";

import {
  formatDeadline,
  formatDeadlineInTimeZone,
  fromJakartaDateTimeInput,
  getDeadlineState,
  toJakartaDateKey,
  toJakartaDateTimeInput,
} from "@starstask/shared";

// 2026-10-29 10:00 WIB == 03:00 UTC.
const NOW = new Date("2026-10-29T03:00:00.000Z");

describe("toJakartaDateKey", () => {
  it("shifts a UTC instant into the Jakarta calendar day", () => {
    expect(toJakartaDateKey("2026-10-29T16:59:00.000Z")).toBe("2026-10-29");
    expect(toJakartaDateKey("2026-10-29T17:00:00.000Z")).toBe("2026-10-30");
  });
});

describe("getDeadlineState", () => {
  it("returns none when there is no deadline", () => {
    expect(getDeadlineState(null, NOW)).toBe("none");
    expect(getDeadlineState(undefined, NOW)).toBe("none");
  });

  it("returns none for an unparseable value instead of guessing", () => {
    expect(getDeadlineState("not-a-date", NOW)).toBe("none");
  });

  it("marks a later instant on the same Jakarta day as due today", () => {
    expect(getDeadlineState("2026-10-29T16:59:00.000Z", NOW)).toBe("due_today");
  });

  it("marks a deadline that already passed today as overdue", () => {
    expect(getDeadlineState("2026-10-29T02:00:00.000Z", NOW)).toBe("overdue");
  });

  it("marks the exact deadline instant as overdue", () => {
    expect(getDeadlineState("2026-10-29T03:00:00.000Z", NOW)).toBe("overdue");
  });

  it("marks the previous Jakarta day as overdue", () => {
    expect(getDeadlineState("2026-10-28T16:59:00.000Z", NOW)).toBe("overdue");
  });

  it("marks the next Jakarta day as upcoming", () => {
    expect(getDeadlineState("2026-10-29T17:01:00.000Z", NOW)).toBe("upcoming");
  });
});

describe("datetime-local conversion", () => {
  it("treats the input as Jakarta wall-clock time", () => {
    expect(fromJakartaDateTimeInput("2026-10-29T23:59")).toBe(
      "2026-10-29T16:59:00.000Z",
    );
  });

  it("round-trips a stored instant back into the form value", () => {
    expect(toJakartaDateTimeInput("2026-10-29T16:59:00.000Z")).toBe(
      "2026-10-29T23:59",
    );
  });

  it("rejects an empty or malformed value", () => {
    expect(fromJakartaDateTimeInput("")).toBeNull();
    expect(fromJakartaDateTimeInput("2026-10-29")).toBeNull();
    expect(fromJakartaDateTimeInput("29/10/2026 23:59")).toBeNull();
  });

  it("rejects a calendar date that does not exist", () => {
    expect(fromJakartaDateTimeInput("2026-02-31T10:00")).toBeNull();
  });
});

describe("formatDeadline", () => {
  it("renders the deadline in WIB", () => {
    expect(formatDeadline("2026-10-29T16:59:00.000Z")).toBe(
      "29 Oct 2026, 23:59 WIB",
    );
  });

  it("returns a stable marker for invalid input", () => {
    expect(formatDeadline("nope")).toBe("Invalid date");
  });
});

describe("formatDeadlineInTimeZone", () => {
  it("uses the user's stored zone instead of assuming WIB", () => {
    expect(formatDeadlineInTimeZone("2026-10-29T16:59:00.000Z", "UTC")).toBe(
      "29 Oct 2026, 16:59 UTC",
    );
    expect(
      formatDeadlineInTimeZone("2026-10-29T16:59:00.000Z", "Asia/Makassar"),
    ).toBe("30 Oct 2026, 00:59 Asia/Makassar");
  });

  it("labels Asia/Jakarta as WIB", () => {
    expect(
      formatDeadlineInTimeZone("2026-10-29T16:59:00.000Z", "Asia/Jakarta"),
    ).toBe("29 Oct 2026, 23:59 WIB");
  });

  it("falls back to Asia/Jakarta for an unknown zone", () => {
    expect(
      formatDeadlineInTimeZone("2026-10-29T16:59:00.000Z", "Mars/Olympus"),
    ).toBe("29 Oct 2026, 23:59 WIB");
  });

  it("returns a stable marker for invalid input", () => {
    expect(formatDeadlineInTimeZone("nope", "UTC")).toBe("Invalid date");
  });
});

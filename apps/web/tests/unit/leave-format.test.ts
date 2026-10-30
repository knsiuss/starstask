import { describe, expect, it } from "vitest";

import {
  buildLeaveReportFilename,
  formatLeaveDate,
  formatLeaveDateRange,
  formatLeaveReportPeriod,
  leaveDayCount,
  parseCalendarDate,
  sanitizeFilenameSegment,
} from "@starstask/shared";

describe("parseCalendarDate", () => {
  it("reads a valid date as UTC midnight", () => {
    const date = parseCalendarDate("2026-03-12");

    expect(date?.toISOString()).toBe("2026-03-12T00:00:00.000Z");
  });

  it("rejects an impossible calendar date", () => {
    // Date would silently roll this into 2 March.
    expect(parseCalendarDate("2026-02-30")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(parseCalendarDate("12/03/2026")).toBeNull();
    expect(parseCalendarDate("")).toBeNull();
    expect(parseCalendarDate("2026-3-2")).toBeNull();
  });
});

describe("formatLeaveDate", () => {
  it("formats without shifting the day", () => {
    // Pinned to UTC so a viewer in any zone sees the stored date.
    expect(formatLeaveDate("2026-03-12")).toBe("12 Mar 2026");
    expect(formatLeaveDate("2026-01-01")).toBe("1 Jan 2026");
  });

  it("falls back to the raw value when unparseable", () => {
    expect(formatLeaveDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatLeaveDateRange", () => {
  it("collapses a single day", () => {
    expect(formatLeaveDateRange("2026-03-12", "2026-03-12")).toBe(
      "12 Mar 2026",
    );
  });

  it("collapses a range inside one month", () => {
    expect(formatLeaveDateRange("2026-03-12", "2026-03-14")).toBe(
      "12–14 Mar 2026",
    );
  });

  it("keeps both months when the range crosses one", () => {
    expect(formatLeaveDateRange("2026-02-28", "2026-03-03")).toBe(
      "28 Feb – 3 Mar 2026",
    );
  });

  it("keeps both years when the range crosses one", () => {
    expect(formatLeaveDateRange("2025-12-30", "2026-01-02")).toBe(
      "30 Dec 2025 – 2 Jan 2026",
    );
  });
});

describe("leaveDayCount", () => {
  it("counts inclusively", () => {
    expect(leaveDayCount("2026-03-12", "2026-03-12")).toBe(1);
    expect(leaveDayCount("2026-03-12", "2026-03-14")).toBe(3);
  });

  it("returns 0 for a reversed or invalid range", () => {
    expect(leaveDayCount("2026-03-14", "2026-03-12")).toBe(0);
    expect(leaveDayCount("2026-02-30", "2026-03-02")).toBe(0);
  });
});

describe("formatLeaveReportPeriod", () => {
  it("labels a closed period", () => {
    expect(formatLeaveReportPeriod("2026-01-01", "2026-03-31")).toBe(
      "1 Jan – 31 Mar 2026",
    );
  });

  it("labels an open-ended period", () => {
    expect(formatLeaveReportPeriod("2026-01-01", null)).toBe("From 1 Jan 2026");
    expect(formatLeaveReportPeriod(null, "2026-03-31")).toBe(
      "Up to 31 Mar 2026",
    );
  });

  it("labels an unbounded period", () => {
    expect(formatLeaveReportPeriod(null, null)).toBe("All dates");
  });
});

describe("sanitizeFilenameSegment", () => {
  it("reduces a slug to safe characters", () => {
    expect(sanitizeFilenameSegment("CS 101 / Data Structures")).toBe(
      "cs-101-data-structures",
    );
  });

  it("strips traversal attempts", () => {
    expect(sanitizeFilenameSegment("../../etc/passwd")).toBe("etc-passwd");
  });

  it("never returns an empty segment", () => {
    expect(sanitizeFilenameSegment("///")).toBe("class");
  });
});

describe("buildLeaveReportFilename", () => {
  it("builds a predictable filename", () => {
    expect(
      buildLeaveReportFilename({
        classSlug: "cs-101",
        format: "summary",
        from: "2026-01-01",
        to: "2026-03-31",
      }),
    ).toBe("starstask-absence-cs-101-2026-01-01-2026-03-31-summary.pdf");
  });

  it("falls back for an open period", () => {
    expect(
      buildLeaveReportFilename({
        classSlug: "cs-101",
        format: "complete",
        from: null,
        to: null,
      }),
    ).toBe("starstask-absence-cs-101-start-today-complete.pdf");
  });

  it("cannot be escaped by a hostile slug", () => {
    const filename = buildLeaveReportFilename({
      classSlug: "../../evil",
      format: "summary",
      from: null,
      to: null,
    });

    expect(filename).not.toContain("..");
    expect(filename).not.toContain("/");
  });
});

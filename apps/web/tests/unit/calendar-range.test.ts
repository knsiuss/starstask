import { describe, expect, it } from "vitest";

import {
  addDaysToDateKey,
  buildCalendarViewRange,
  dateKeyWeekday,
  expandWeeklyScheduleForDays,
  parseCalendarDateKey,
  shiftCalendarAnchor,
  startOfWeekDateKey,
} from "@starstask/shared";

describe("calendar date keys", () => {
  it("rejects an impossible calendar date", () => {
    expect(parseCalendarDateKey("2026-02-31")).toBeNull();
    expect(parseCalendarDateKey("2026-13-01")).toBeNull();
  });

  it("computes ISO weekdays and the Monday of a week", () => {
    expect(dateKeyWeekday("2026-10-26")).toBe(1);
    expect(startOfWeekDateKey("2026-10-30")).toBe("2026-10-26");
  });

  it("adds days across a month boundary", () => {
    expect(addDaysToDateKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToDateKey("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("buildCalendarViewRange", () => {
  it("builds a six-week month grid with Jakarta query bounds", () => {
    const range = buildCalendarViewRange("month", "2026-10-30");

    expect(range.days).toHaveLength(42);
    expect(range.days[0]?.dateKey).toBe("2026-09-28");
    expect(range.days[0]?.inMonth).toBe(false);
    expect(range.days[3]?.inMonth).toBe(true);
    expect(range.days[41]?.dateKey).toBe("2026-11-08");
    expect(range.fromIso).toBe("2026-09-28T00:00:00+07:00");
    expect(range.toIso).toBe("2026-11-09T00:00:00+07:00");
  });

  it("builds a Monday-to-Sunday week", () => {
    const range = buildCalendarViewRange("week", "2026-10-30");

    expect(range.days.map((day) => day.dateKey)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("builds one day and a thirty-day agenda", () => {
    expect(buildCalendarViewRange("day", "2026-10-30").days).toHaveLength(1);
    expect(buildCalendarViewRange("agenda", "2026-10-30").days).toHaveLength(
      30,
    );
  });
});

describe("shiftCalendarAnchor", () => {
  it("shifts weeks and days", () => {
    expect(shiftCalendarAnchor("week", "2026-10-30", 1)).toBe("2026-11-06");
    expect(shiftCalendarAnchor("day", "2026-10-30", -1)).toBe("2026-10-29");
  });

  it("clamps a month shift to the last day of the next month", () => {
    expect(shiftCalendarAnchor("month", "2026-01-31", 1)).toBe("2026-02-28");
  });

  it("moves the agenda by thirty days", () => {
    expect(shiftCalendarAnchor("agenda", "2026-10-30", 1)).toBe("2026-11-29");
  });
});

describe("expandWeeklyScheduleForDays", () => {
  it("only emits occurrences on the matching weekday", () => {
    const entries = [
      {
        id: "slot-1",
        day_of_week: 1,
        start_time: "08:00:00",
        end_time: "10:00:00",
      },
    ];

    const occurrences = expandWeeklyScheduleForDays(entries, [
      "2026-10-26",
      "2026-10-27",
    ]);

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.startsAt).toBe("2026-10-26T08:00:00+07:00");
    expect(occurrences[0]?.endsAt).toBe("2026-10-26T10:00:00+07:00");
  });

  it("skips a malformed wall-clock time", () => {
    const entries = [
      {
        id: "slot-1",
        day_of_week: 1,
        start_time: "8am",
        end_time: "10:00:00",
      },
    ];

    expect(expandWeeklyScheduleForDays(entries, ["2026-10-26"])).toHaveLength(
      0,
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  buildCalendarMonth,
  formatMonthLabel,
  formatSessionDate,
  formatSessionRange,
  formatSessionTime,
  isKnownTimeZone,
  isoToZonedDateTimeInput,
  resolveTimeZone,
  sessionDurationMinutes,
  sessionMonthWindow,
  shiftMonth,
  timeZoneLabel,
  toDateKey,
  zonedDateTimeInputToIso,
} from "@starstask/shared";

describe("formatSessionDate / formatSessionTime", () => {
  it("renders the instant in the session's own zone", () => {
    expect(formatSessionDate("2026-11-05T12:00:00.000Z", "Asia/Jakarta")).toBe(
      "05 Nov 2026",
    );
    expect(formatSessionTime("2026-11-05T12:00:00.000Z", "Asia/Jakarta")).toBe(
      "19:00",
    );
  });

  it("can include the weekday", () => {
    expect(
      formatSessionDate("2026-11-05T12:00:00.000Z", "Asia/Jakarta", {
        withWeekday: true,
      }),
    ).toBe("Thu, 05 Nov 2026");
  });

  it("shows a different local day for the same instant in another zone", () => {
    // 19:00 in Jakarta is 12:00 UTC and 07:00 in New York, still the same day;
    // 23:30 UTC is already the next day in Jakarta.
    expect(formatSessionDate("2026-11-05T23:30:00.000Z", "Asia/Jakarta")).toBe(
      "06 Nov 2026",
    );
    expect(
      formatSessionDate("2026-11-05T23:30:00.000Z", "America/New_York"),
    ).toBe("05 Nov 2026");
  });

  it("never throws on an unparseable value", () => {
    expect(formatSessionDate("not a date", "Asia/Jakarta")).toBe(
      "Invalid date",
    );
    expect(formatSessionTime("not a date", "Asia/Jakarta")).toBe(
      "Invalid time",
    );
  });
});

describe("formatSessionRange", () => {
  it("joins the start and end time with the zone label", () => {
    expect(
      formatSessionRange(
        "2026-11-05T12:00:00.000Z",
        "2026-11-05T14:00:00.000Z",
        "Asia/Jakarta",
      ),
    ).toBe("Thu, 05 Nov 2026, 19:00–21:00 WIB");
  });

  it("repeats the date when the session ends on another day", () => {
    const label = formatSessionRange(
      "2026-11-05T16:00:00.000Z",
      "2026-11-05T18:00:00.000Z",
      "Asia/Jakarta",
    );

    expect(label).toBe("Thu, 05 Nov 2026, 23:00–Fri, 06 Nov 2026, 01:00 WIB");
  });

  it("uses the IANA name for zones without a short label", () => {
    expect(
      formatSessionRange(
        "2026-11-05T12:00:00.000Z",
        "2026-11-05T13:00:00.000Z",
        "America/New_York",
      ),
    ).toContain("America/New_York");
  });
});

describe("time zone helpers", () => {
  it("recognises valid zones and rejects made-up ones", () => {
    expect(isKnownTimeZone("Asia/Jakarta")).toBe(true);
    expect(isKnownTimeZone("Mars/Olympus")).toBe(false);
  });

  it("falls back to the app zone instead of throwing", () => {
    expect(resolveTimeZone("Mars/Olympus")).toBe("Asia/Jakarta");
    expect(resolveTimeZone(null)).toBe("Asia/Jakarta");
    expect(resolveTimeZone("Europe/Berlin")).toBe("Europe/Berlin");
  });

  it("labels Jakarta as WIB and leaves other zones as-is", () => {
    expect(timeZoneLabel("Asia/Jakarta")).toBe("WIB");
    expect(timeZoneLabel("Europe/Berlin")).toBe("Europe/Berlin");
  });
});

describe("toDateKey", () => {
  it("returns the local calendar date", () => {
    expect(toDateKey("2026-11-05T23:30:00.000Z", "Asia/Jakarta")).toBe(
      "2026-11-06",
    );
    expect(toDateKey("2026-11-05T23:30:00.000Z", "America/New_York")).toBe(
      "2026-11-05",
    );
  });
});

describe("sessionDurationMinutes", () => {
  it("rounds to whole minutes", () => {
    expect(
      sessionDurationMinutes(
        "2026-11-05T12:00:00.000Z",
        "2026-11-05T14:30:00.000Z",
      ),
    ).toBe(150);
  });

  it("returns zero for an inverted or invalid window", () => {
    expect(
      sessionDurationMinutes(
        "2026-11-05T14:00:00.000Z",
        "2026-11-05T12:00:00.000Z",
      ),
    ).toBe(0);
    expect(sessionDurationMinutes("x", "y")).toBe(0);
  });
});

describe("zonedDateTimeInputToIso", () => {
  it("interprets a wall-clock input in the given zone", () => {
    expect(zonedDateTimeInputToIso("2026-11-05T19:00", "Asia/Jakarta")).toBe(
      "2026-11-05T12:00:00.000Z",
    );
  });

  it("respects daylight saving transitions", () => {
    // 08 March 2026 is the US spring-forward date: 03:30 is EDT (UTC-4).
    expect(
      zonedDateTimeInputToIso("2026-03-08T03:30", "America/New_York"),
    ).toBe("2026-03-08T07:30:00.000Z");

    // The day before, 02:30 is still EST (UTC-5).
    expect(
      zonedDateTimeInputToIso("2026-03-07T02:30", "America/New_York"),
    ).toBe("2026-03-07T07:30:00.000Z");
  });

  it("rejects a local time that does not exist", () => {
    expect(
      zonedDateTimeInputToIso("2026-03-08T02:30", "America/New_York"),
    ).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(zonedDateTimeInputToIso("", "Asia/Jakarta")).toBeNull();
    expect(
      zonedDateTimeInputToIso("5 November 2026 19:00", "Asia/Jakarta"),
    ).toBeNull();
  });

  it("round-trips with isoToZonedDateTimeInput", () => {
    const iso = zonedDateTimeInputToIso("2026-11-05T19:00", "Asia/Jakarta");

    expect(iso).not.toBeNull();
    expect(isoToZonedDateTimeInput(iso ?? "", "Asia/Jakarta")).toBe(
      "2026-11-05T19:00",
    );
  });
});

describe("buildCalendarMonth", () => {
  it("builds six Monday-first weeks", () => {
    const weeks = buildCalendarMonth(2026, 11);

    expect(weeks).toHaveLength(6);
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
    expect(weeks[0]?.[0]?.dateKey).toBe("2026-10-26");
  });

  it("marks the days outside the month", () => {
    const weeks = buildCalendarMonth(2026, 11);
    const flat = weeks.flat();
    const firstOfMonth = flat.find((day) => day.dateKey === "2026-11-01");

    expect(firstOfMonth?.inMonth).toBe(true);
    expect(flat.find((day) => day.dateKey === "2026-10-31")?.inMonth).toBe(
      false,
    );
  });
});

describe("shiftMonth", () => {
  it("moves forward across a year boundary", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("moves back across a year boundary", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("stays within 1-12 for a multi-year jump", () => {
    expect(shiftMonth(2026, 3, -25)).toEqual({ year: 2024, month: 2 });
  });
});

describe("formatMonthLabel", () => {
  it("names the month and year", () => {
    expect(formatMonthLabel(2026, 11)).toBe("November 2026");
  });
});

describe("sessionMonthWindow", () => {
  it("pads the month by a day on each side", () => {
    expect(sessionMonthWindow(2026, 11)).toEqual({
      from: "2026-10-31T00:00:00.000Z",
      to: "2026-12-02T00:00:00.000Z",
    });
  });

  it("handles December without rolling into the wrong year", () => {
    expect(sessionMonthWindow(2026, 12)).toEqual({
      from: "2026-11-30T00:00:00.000Z",
      to: "2027-01-02T00:00:00.000Z",
    });
  });
});

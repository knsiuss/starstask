import { describe, expect, it } from "vitest";

import { summarizeCheckInDay, type CheckInDaySession } from "@starstask/shared";

const NOW = Date.parse("2026-11-02T10:00:00Z");

const openWindow: CheckInDaySession = {
  opensAt: "2026-11-02T09:45:00Z",
  closesAt: "2026-11-02T11:00:00Z",
  status: null,
};

const closedWindow: CheckInDaySession = {
  opensAt: "2026-11-02T07:00:00Z",
  closesAt: "2026-11-02T08:00:00Z",
  status: null,
};

const futureWindow: CheckInDaySession = {
  opensAt: "2026-11-02T12:00:00Z",
  closesAt: "2026-11-02T13:00:00Z",
  status: null,
};

describe("summarizeCheckInDay", () => {
  it("counts recorded present and late rows", () => {
    const counts = summarizeCheckInDay(
      [
        { ...openWindow, status: "present" },
        { ...closedWindow, status: "late" },
      ],
      NOW,
    );

    expect(counts).toEqual({ present: 1, late: 1, notCheckedIn: 0 });
  });

  it("counts an open window with no row as not yet checked in", () => {
    const counts = summarizeCheckInDay([openWindow], NOW);

    expect(counts).toEqual({ present: 0, late: 0, notCheckedIn: 1 });
  });

  it("leaves a closed window without a row out of the check-in strip", () => {
    const counts = summarizeCheckInDay([closedWindow], NOW);

    expect(counts).toEqual({ present: 0, late: 0, notCheckedIn: 0 });
  });

  it("does not count a window that has not opened yet", () => {
    const counts = summarizeCheckInDay([futureWindow], NOW);

    expect(counts).toEqual({ present: 0, late: 0, notCheckedIn: 0 });
  });

  it("ignores excused and absent rows", () => {
    const counts = summarizeCheckInDay(
      [
        { ...openWindow, status: "excused" },
        { ...openWindow, status: "absent" },
      ],
      NOW,
    );

    expect(counts).toEqual({ present: 0, late: 0, notCheckedIn: 0 });
  });

  it("counts a recorded row even when its window has already closed", () => {
    const counts = summarizeCheckInDay(
      [{ ...closedWindow, status: "present" }],
      NOW,
    );

    expect(counts).toEqual({ present: 1, late: 0, notCheckedIn: 0 });
  });

  it("treats an invalid window as closed instead of inventing a count", () => {
    const counts = summarizeCheckInDay(
      [{ opensAt: "not-a-date", closesAt: "not-a-date", status: null }],
      NOW,
    );

    expect(counts).toEqual({ present: 0, late: 0, notCheckedIn: 0 });
  });
});

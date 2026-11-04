import { describe, expect, it } from "vitest";

import {
  filterForCalendarView,
  isAssignmentHiddenFromDefault,
  isExpiredItem,
} from "@/lib/schedule/lifecycle";

const TODAY = "2026-11-04";

describe("isExpiredItem", () => {
  it("treats a deadline today as still active, not expired", () => {
    expect(isExpiredItem({ endKey: TODAY }, TODAY)).toBe(false);
  });

  it("treats yesterday as expired, and tomorrow as active", () => {
    expect(isExpiredItem({ endKey: "2026-11-03" }, TODAY)).toBe(true);
    expect(isExpiredItem({ endKey: "2026-11-05" }, TODAY)).toBe(false);
  });
});

describe("isAssignmentHiddenFromDefault", () => {
  it("hides a past-due assignment the user has not completed", () => {
    expect(
      isAssignmentHiddenFromDefault(
        { endKey: "2026-11-01", isCompleted: false },
        TODAY,
      ),
    ).toBe(true);
  });

  it("keeps a completed past-due assignment visible (completion semantics unchanged)", () => {
    expect(
      isAssignmentHiddenFromDefault(
        { endKey: "2026-11-01", isCompleted: true },
        TODAY,
      ),
    ).toBe(false);
  });

  it("keeps an upcoming assignment visible", () => {
    expect(
      isAssignmentHiddenFromDefault(
        { endKey: "2026-11-10", isCompleted: false },
        TODAY,
      ),
    ).toBe(false);
  });
});

describe("filterForCalendarView", () => {
  const items = [
    { id: "upcoming", endKey: "2026-11-10" },
    { id: "today", endKey: "2026-11-04" },
    { id: "past", endKey: "2026-11-01" },
  ];

  it("removes expired items from the default view", () => {
    expect(
      filterForCalendarView(items, TODAY, false).map((item) => item.id),
    ).toEqual(["upcoming", "today"]);
  });

  it("keeps every item when history is shown", () => {
    expect(
      filterForCalendarView(items, TODAY, true).map((item) => item.id),
    ).toEqual(["upcoming", "today", "past"]);
  });

  it("handles the empty list", () => {
    expect(filterForCalendarView([], TODAY, false)).toEqual([]);
  });
});

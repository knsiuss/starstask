import { describe, expect, it } from "vitest";

import {
  EMPTY_ACTION_COUNTS,
  countActions,
  selectActionCenterClasses,
  sortActionCenterRows,
  summarizeActionCenter,
  toActionCenterRow,
  type ActionCenterClass,
  type ActionCenterRow,
} from "@/lib/classes/action-center";

function classItem(
  overrides: Partial<ActionCenterClass> = {},
): ActionCenterClass {
  return {
    id: "class-1",
    slug: "database-systems",
    name: "Database Systems",
    semester: "2",
    academic_year: "2026/2027",
    status: "active",
    is_admin: true,
    ...overrides,
  };
}

function row(overrides: Partial<ActionCenterRow> = {}): ActionCenterRow {
  return {
    classId: "class-1",
    classSlug: "database-systems",
    className: "Database Systems",
    semester: "2",
    academicYear: "2026/2027",
    pendingSubmissions: 0,
    pendingLeave: 0,
    todaysSessions: 0,
    openReports: 0,
    total: 0,
    ...overrides,
  };
}

describe("selectActionCenterClasses", () => {
  it("keeps only active classes the caller administers", () => {
    const selected = selectActionCenterClasses([
      classItem({ id: "active-admin" }),
      classItem({ id: "active-member", is_admin: false }),
      classItem({ id: "archived-admin", status: "archived" }),
      classItem({ id: "draft-admin", status: "draft" }),
    ]);

    expect(selected.map((item) => item.id)).toEqual(["active-admin"]);
  });

  it("returns an empty list when the caller leads nothing", () => {
    expect(
      selectActionCenterClasses([
        classItem({ is_admin: false }),
        classItem({ status: "archived" }),
      ]),
    ).toEqual([]);
  });
});

describe("countActions", () => {
  it("sums every queue", () => {
    expect(
      countActions({
        pendingSubmissions: 3,
        pendingLeave: 1,
        todaysSessions: 2,
        openReports: 4,
      }),
    ).toBe(10);
  });

  it("is zero for the empty counts", () => {
    expect(countActions(EMPTY_ACTION_COUNTS)).toBe(0);
  });
});

describe("toActionCenterRow", () => {
  it("copies class identity and computes the total", () => {
    const result = toActionCenterRow(classItem(), {
      pendingSubmissions: 2,
      pendingLeave: 0,
      todaysSessions: 1,
      openReports: 3,
    });

    expect(result).toMatchObject({
      classId: "class-1",
      classSlug: "database-systems",
      className: "Database Systems",
      semester: "2",
      academicYear: "2026/2027",
      pendingSubmissions: 2,
      pendingLeave: 0,
      todaysSessions: 1,
      openReports: 3,
      total: 6,
    });
  });
});

describe("sortActionCenterRows", () => {
  it("puts the busiest class first and breaks ties by name", () => {
    const sorted = sortActionCenterRows([
      row({ classId: "quiet", className: "Quiet", total: 0 }),
      row({ classId: "zulu", className: "Zulu", total: 2 }),
      row({ classId: "alpha", className: "Alpha", total: 2 }),
      row({ classId: "busy", className: "Busy", total: 5 }),
    ]);

    expect(sorted.map((item) => item.classId)).toEqual([
      "busy",
      "alpha",
      "zulu",
      "quiet",
    ]);
  });

  it("does not mutate the input", () => {
    const rows = [
      row({ classId: "first", total: 0 }),
      row({ classId: "second", total: 1 }),
    ];

    sortActionCenterRows(rows);

    expect(rows.map((item) => item.classId)).toEqual(["first", "second"]);
  });
});

describe("summarizeActionCenter", () => {
  it("adds every column and counts classes", () => {
    const totals = summarizeActionCenter([
      row({ pendingSubmissions: 2, pendingLeave: 1, total: 3 }),
      row({ todaysSessions: 4, openReports: 1, total: 5 }),
    ]);

    expect(totals).toEqual({
      pendingSubmissions: 2,
      pendingLeave: 1,
      todaysSessions: 4,
      openReports: 1,
      classes: 2,
      actions: 8,
    });
  });

  it("returns zeroed totals for no rows", () => {
    expect(summarizeActionCenter([])).toEqual({
      ...EMPTY_ACTION_COUNTS,
      classes: 0,
      actions: 0,
    });
  });
});

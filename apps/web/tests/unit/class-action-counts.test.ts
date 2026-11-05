import { describe, expect, it } from "vitest";

import {
  mergeActionCounts,
  type ActionCenterClass,
  type ActionCounts,
} from "@/lib/classes/action-center";

const CLASS_A: ActionCenterClass = {
  id: "00000000-0000-4000-8000-000000000101",
  slug: "class-a",
  name: "Class A",
  semester: "1",
  academic_year: "2026/2027",
  status: "active",
  is_admin: true,
};

const CLASS_B: ActionCenterClass = {
  id: "00000000-0000-4000-8000-000000000102",
  slug: "class-b",
  name: "Class B",
  semester: "1",
  academic_year: "2026/2027",
  status: "active",
  is_admin: true,
};

describe("mergeActionCounts", () => {
  it("pairs each class with its grouped count row", () => {
    const counts = new Map<string, ActionCounts>([
      [
        CLASS_A.id,
        {
          pendingSubmissions: 2,
          pendingLeave: 1,
          todaysSessions: 3,
          openReports: 4,
        },
      ],
      [
        CLASS_B.id,
        {
          pendingSubmissions: 0,
          pendingLeave: 0,
          todaysSessions: 0,
          openReports: 0,
        },
      ],
    ]);

    const rows = mergeActionCounts([CLASS_A, CLASS_B], counts);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      classId: CLASS_A.id,
      pendingSubmissions: 2,
      pendingLeave: 1,
      todaysSessions: 3,
      openReports: 4,
      total: 10,
    });
    expect(rows[1]?.total).toBe(0);
  });

  it("counts a class missing from the RPC result as zero", () => {
    const rows = mergeActionCounts([CLASS_A], new Map());

    expect(rows[0]).toMatchObject({
      classId: CLASS_A.id,
      pendingSubmissions: 0,
      pendingLeave: 0,
      todaysSessions: 0,
      openReports: 0,
      total: 0,
    });
  });

  it("ignores count rows for classes that were not requested", () => {
    const counts = new Map<string, ActionCounts>([
      [
        "00000000-0000-4000-8000-000000000199",
        {
          pendingSubmissions: 9,
          pendingLeave: 9,
          todaysSessions: 9,
          openReports: 9,
        },
      ],
    ]);

    const rows = mergeActionCounts([CLASS_A], counts);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.total).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import {
  buildClassCourseRows,
  buildCourseRows,
  courseAttendanceStatus,
} from "@/lib/attendance/course-rows";
import { summarizeAttendance } from "@starstask/shared";

const SUBJECTS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Pemrograman Web",
    code: "TPLM002",
    classId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    className: "TPL 2024",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Basis Data",
    code: "TPLM003",
    classId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    className: "TPL 2024",
  },
];

describe("courseAttendanceStatus", () => {
  it("has no status before a single session closes", () => {
    expect(courseAttendanceStatus(summarizeAttendance([]))).toBe("no_sessions");
  });

  it("maps the percentage bands", () => {
    expect(courseAttendanceStatus({ percentage: 100, eligible: 8 })).toBe(
      "excellent",
    );
    expect(courseAttendanceStatus({ percentage: 90, eligible: 8 })).toBe(
      "excellent",
    );
    expect(courseAttendanceStatus({ percentage: 87.5, eligible: 8 })).toBe(
      "good",
    );
    expect(courseAttendanceStatus({ percentage: 75, eligible: 8 })).toBe(
      "good",
    );
    expect(courseAttendanceStatus({ percentage: 62.5, eligible: 8 })).toBe(
      "fair",
    );
    expect(courseAttendanceStatus({ percentage: 59.9, eligible: 8 })).toBe(
      "at_risk",
    );
  });

  it("treats a null percentage as no sessions", () => {
    expect(courseAttendanceStatus({ percentage: null, eligible: 0 })).toBe(
      "no_sessions",
    );
  });
});

describe("buildCourseRows", () => {
  it("lists every course, including one without sessions", () => {
    const rows = buildCourseRows({
      subjects: SUBJECTS,
      bySubject: [
        {
          key: SUBJECTS[0]?.id ?? "",
          label: "Pemrograman Web",
          secondaryLabel: "TPL 2024",
          counts: summarizeAttendance([
            "present",
            "present",
            "present",
            "late",
          ]),
        },
      ],
      byClass: [],
    });

    expect(rows).toHaveLength(2);

    const web = rows.find((row) => row.code === "TPLM002");
    const data = rows.find((row) => row.code === "TPLM003");

    expect(web?.counts.percentage).toBe(100);
    expect(web?.status).toBe("excellent");
    expect(data?.counts.eligible).toBe(0);
    expect(data?.status).toBe("no_sessions");
  });

  it("sorts courses by code", () => {
    const rows = buildCourseRows({
      subjects: [...SUBJECTS].reverse(),
      bySubject: [],
      byClass: [],
    });

    expect(rows.map((row) => row.code)).toEqual(["TPLM002", "TPLM003"]);
  });

  it("falls back to class rows when a class has no subjects", () => {
    const rows = buildCourseRows({
      subjects: [],
      bySubject: [],
      byClass: [
        {
          key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          label: "TPL 2024",
          secondaryLabel: "2024/2025 · Semester 5",
          counts: summarizeAttendance(["present", "absent"]),
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.subjectId).toBeNull();
    expect(rows[0]?.counts.percentage).toBe(50);
    expect(rows[0]?.status).toBe("at_risk");
  });
});

const CLASS_SUBJECTS = [
  { id: SUBJECTS[0]?.id ?? "", name: "Pemrograman Web", code: "TPLM002" },
  { id: SUBJECTS[1]?.id ?? "", name: "Basis Data", code: "TPLM003" },
];

describe("buildClassCourseRows", () => {
  const webCounts = summarizeAttendance([
    "present",
    "present",
    "present",
    "late",
    "absent",
  ]);

  it("keeps a course that has no attendance yet", () => {
    const rows = buildClassCourseRows({
      subjects: CLASS_SUBJECTS,
      groups: [
        {
          key: CLASS_SUBJECTS[0]?.id ?? "",
          label: "Pemrograman Web",
          secondaryLabel: "TPL 2024",
          counts: webCounts,
        },
      ],
    });

    expect(rows.map((row) => row.code)).toEqual(["TPLM002", "TPLM003"]);

    const data = rows.find((row) => row.code === "TPLM003");

    expect(data?.counts.percentage).toBeNull();
    expect(data?.sessionCount).toBe(0);
    expect(data?.status).toBe("no_sessions");
  });

  it("counts the sessions that actually belong to each course", () => {
    const rows = buildClassCourseRows({
      subjects: CLASS_SUBJECTS,
      groups: [
        {
          key: CLASS_SUBJECTS[0]?.id ?? "",
          label: "Pemrograman Web",
          secondaryLabel: "TPL 2024",
          counts: webCounts,
        },
      ],
    });

    const web = rows.find((row) => row.code === "TPLM002");

    expect(web?.sessionCount).toBe(5);
    expect(web?.counts.attended).toBe(4);
    expect(web?.counts.percentage).toBe(80);
    expect(web?.status).toBe("good");
  });

  it("prefers a stored meeting count over the session total", () => {
    const rows = buildClassCourseRows({
      subjects: CLASS_SUBJECTS,
      groups: [
        {
          key: CLASS_SUBJECTS[0]?.id ?? "",
          label: "Pemrograman Web",
          secondaryLabel: "TPL 2024",
          counts: webCounts,
        },
      ],
      sessionCounts: new Map<string, number>([
        [CLASS_SUBJECTS[0]?.id ?? "", 10],
      ]),
    });

    const web = rows.find((row) => row.code === "TPLM002");

    expect(web?.sessionCount).toBe(10);
    expect(web?.counts.percentage).toBe(80);
  });

  it("drops aggregates that are not a course of this class", () => {
    const rows = buildClassCourseRows({
      subjects: CLASS_SUBJECTS.slice(0, 1),
      groups: [
        {
          key: "99999999-9999-4999-8999-999999999999",
          label: "Another course",
          secondaryLabel: "Other class",
          counts: summarizeAttendance(["absent"]),
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.counts.eligible).toBe(0);
  });
});

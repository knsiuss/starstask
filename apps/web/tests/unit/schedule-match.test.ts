import { describe, expect, it } from "vitest";

import {
  matchScheduleRow,
  normalizeScheduleName,
} from "@/features/schedule/schedule-match";
import type { ParsedScheduleRow } from "@/lib/ocr/schedule-parse";

const SUBJECTS = [
  {
    id: "web",
    name: "Pemrograman Web 1",
    code: "PW1",
    lecturer_name: "Dede Sunandar",
  },
  {
    id: "ml",
    name: "Machine Learning",
    code: null,
    lecturer_name: "Agung Perdanan",
  },
  {
    id: "sim",
    name: "Sistem Informasi Manajemen",
    code: null,
    lecturer_name: "Dani Ramdani",
  },
  {
    id: "digital",
    name: "Digital Entrepreneurship",
    code: null,
    lecturer_name: "Nana Hermansyah",
  },
];

function row(overrides: Partial<ParsedScheduleRow>): ParsedScheduleRow {
  return {
    rowNumber: 1,
    courseCode: "22TIF0283",
    nameSegment: "PEMROGRAMAN WEB I DEDE SUNANDAR",
    classCode: "05TPLM002",
    dayOfWeek: 1,
    startTime: "18:20",
    endTime: "20:00",
    period: "1",
    room: "V.117",
    startDate: "2026-08-31",
    endDate: "2027-01-31",
    ...overrides,
  };
}

describe("normalizeScheduleName", () => {
  it("lowercases, strips punctuation, and equates roman numerals", () => {
    expect(normalizeScheduleName("Pemrograman Web I")).toBe(
      "pemrograman web 1",
    );
    expect(normalizeScheduleName("  Teknik   Riset-Operasional! ")).toBe(
      "teknik riset operasional",
    );
  });
});

describe("matchScheduleRow", () => {
  it("matches by course code first", () => {
    const matched = matchScheduleRow(row({ courseCode: "PW1" }), SUBJECTS);

    expect(matched.subjectId).toBe("web");
    expect(matched.matchedBy).toBe("code");
    expect(matched.courseName).toBe("Pemrograman Web 1");
    expect(matched.lecturerName).toBe("Dede Sunandar");
  });

  it("matches by normalized name and splits off the lecturer", () => {
    const matched = matchScheduleRow(row({}), SUBJECTS);

    expect(matched.subjectId).toBe("web");
    expect(matched.matchedBy).toBe("name+lecturer");
    expect(matched.lecturerName).toBe("Dede Sunandar");
  });

  it("prefers the longest name and uses the lecturer to break a tie", () => {
    const tied = [
      {
        id: "web-dasar",
        name: "Pemrograman Web",
        code: null,
        lecturer_name: "Budi Santoso",
      },
      {
        id: "web",
        name: "Pemrograman Web 1",
        code: null,
        lecturer_name: "Dede Sunandar",
      },
    ];

    const matched = matchScheduleRow(row({}), tied);

    expect(matched.subjectId).toBe("web");
    expect(matched.matchedBy).toBe("name+lecturer");
    expect(matched.lecturerName).toBe("Dede Sunandar");
  });

  it("returns no match instead of guessing", () => {
    const matched = matchScheduleRow(
      row({ nameSegment: "ASTROFISIKA KUANTUM SARI DEWI" }),
      SUBJECTS,
    );

    expect(matched.subjectId).toBeNull();
    expect(matched.matchedBy).toBe("none");
    // Without a subject the name/lecturer split is unknowable; the whole
    // segment is shown so the user can see what was read.
    expect(matched.courseName).toBe("Astrofisika Kuantum Sari Dewi");
    expect(matched.lecturerName).toBeNull();
    expect(matched.warnings).toHaveLength(1);
  });
});

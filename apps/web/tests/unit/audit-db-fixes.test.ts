import { describe, expect, it } from "vitest";

import { parseGradeCsv } from "@/lib/db/grades-publish";
import { hashPluginEventContent } from "@/lib/db/plugins";

const CSV_HEADER =
  "student_id,course_code,score,grade_letter,semester_code,academic_year_code";

describe("parseGradeCsv", () => {
  it("rejects empty or whitespace-only score cells", () => {
    expect(() =>
      parseGradeCsv(`${CSV_HEADER}\nSTU-001,CS101,,A,2026-1,2026`),
    ).toThrow("Invalid row 2");

    expect(() =>
      parseGradeCsv(`${CSV_HEADER}\nSTU-001,CS101,   ,A,2026-1,2026`),
    ).toThrow("Invalid row 2");
  });

  it("accepts explicit zero and decimal scores within 0..100", () => {
    const rows = parseGradeCsv(
      `${CSV_HEADER}\nSTU-001,CS101,0,E,2026-1,2026\nSTU-002,CS101,85.5,A,2026-1,2026`,
    );

    expect(rows).toEqual([
      {
        studentId: "STU-001",
        courseCode: "CS101",
        score: 0,
        gradeLetter: "E",
        semesterCode: "2026-1",
        academicYearCode: "2026",
      },
      {
        studentId: "STU-002",
        courseCode: "CS101",
        score: 85.5,
        gradeLetter: "A",
        semesterCode: "2026-1",
        academicYearCode: "2026",
      },
    ]);
  });

  it("rejects non-numeric and out-of-range scores", () => {
    expect(() =>
      parseGradeCsv(`${CSV_HEADER}\nSTU-001,CS101,abc,A,2026-1,2026`),
    ).toThrow("Invalid row 2");

    expect(() =>
      parseGradeCsv(`${CSV_HEADER}\nSTU-001,CS101,-1,E,2026-1,2026`),
    ).toThrow("Invalid row 2");

    expect(() =>
      parseGradeCsv(`${CSV_HEADER}\nSTU-001,CS101,101,A,2026-1,2026`),
    ).toThrow("Invalid row 2");
  });
});

describe("hashPluginEventContent", () => {
  it("returns a 64-character SHA-256 hex digest", () => {
    const digest = hashPluginEventContent(
      "events|Seminar Nasional Teknik Informatika|2026-11-20T09:00:00Z",
    );

    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces distinct digests for events with identical prefixes", () => {
    const first = hashPluginEventContent(
      "academic-calendar|Ujian Akhir Semester Gelombang 1|2026-12-01T08:00:00Z",
    );
    const second = hashPluginEventContent(
      "academic-calendar|Ujian Akhir Semester Gelombang 2|2026-12-08T08:00:00Z",
    );

    expect(first).not.toBe(second);
    expect(first).toBe(
      hashPluginEventContent(
        "academic-calendar|Ujian Akhir Semester Gelombang 1|2026-12-01T08:00:00Z",
      ),
    );
  });
});

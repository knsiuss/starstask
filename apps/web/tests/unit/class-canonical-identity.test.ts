import { describe, expect, it } from "vitest";

import {
  buildCanonicalClassIdentity,
  classJoinOrCreateSchema,
  parseCanonicalClassName,
  studentCreateClassSchema,
} from "@starstask/contracts";

describe("buildCanonicalClassIdentity", () => {
  it("formats semester, uppercase class code, and short academic year", () => {
    expect(
      buildCanonicalClassIdentity({
        classCode: "tplm002",
        semesterNumber: 5,
        academicYear: "2024/2025",
      }),
    ).toEqual({
      classCode: "TPLM002",
      semesterNumber: 5,
      semesterLabel: "Semester 5",
      academicYear: "2024/2025",
      name: "05TPLM002-24/25",
      slug: "05tplm002-24-25",
    });
  });

  it("keeps two-digit semesters unpadded", () => {
    const result = buildCanonicalClassIdentity({
      classCode: "IF101",
      semesterNumber: 10,
      academicYear: "2025/2026",
    });

    expect(result.name).toBe("10IF101-25/26");
    expect(result.slug).toBe("10if101-25-26");
  });
});

describe("studentCreateClassSchema", () => {
  it("accepts valid structured class creation input", () => {
    const parsed = studentCreateClassSchema.safeParse({
      classCode: "tplm002",
      semesterNumber: "5",
      academicYear: "2024/2025",
      courseName: "Pemrograman Web 1",
      description: "Workspace untuk tugas dan jadwal kelas TPLM002.",
      joinPolicy: "invitation",
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.classCode).toBe("TPLM002");
      expect(parsed.data.semesterNumber).toBe(5);
    }
  });

  it("rejects invalid class codes with spaces or symbols", () => {
    const parsed = studentCreateClassSchema.safeParse({
      classCode: "TPLM 002!",
      semesterNumber: 5,
      academicYear: "2024/2025",
      courseName: "Pemrograman Web 1",
      description: "Workspace untuk tugas dan jadwal kelas TPLM002.",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("classJoinOrCreateSchema", () => {
  it("normalizes structured join-or-create payload", () => {
    const parsed = classJoinOrCreateSchema.safeParse({
      classCode: " tplm002 ",
      semesterNumber: "5",
      academicYear: "2024/2025",
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data).toEqual({
        classCode: "TPLM002",
        semesterNumber: 5,
        academicYear: "2024/2025",
      });
    }
  });
});

describe("parseCanonicalClassName", () => {
  it("parses canonical 05TPLM002-24/25 strings back to structured identity", () => {
    expect(parseCanonicalClassName("05TPLM002-24/25")).toEqual({
      classCode: "TPLM002",
      semesterNumber: 5,
      semesterLabel: "Semester 5",
      academicYear: "2024/2025",
      name: "05TPLM002-24/25",
      slug: "05tplm002-24-25",
    });
    expect(parseCanonicalClassName("free-form-class")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { lecturerCreateClassSchema } from "@/features/classes/lecturer-create-schemas";

const validBase = {
  name: "Database Systems Class B",
  courseName: "Database Systems",
  semester: "1",
  academicYear: "2026/2027",
  description: "Weekly database labs and their graded assignments.",
};

describe("lecturer create class schema", () => {
  it("accepts a minimal valid payload", () => {
    expect(lecturerCreateClassSchema.safeParse(validBase).success).toBe(true);
  });

  it("requires an academic year in the YYYY/YYYY format", () => {
    expect(
      lecturerCreateClassSchema.safeParse({
        ...validBase,
        academicYear: "2026/2027",
      }).success,
    ).toBe(true);

    for (const academicYear of ["2026-2027", "202", "26/27"]) {
      expect(
        lecturerCreateClassSchema.safeParse({ ...validBase, academicYear })
          .success,
      ).toBe(false);
    }
  });

  it("accepts a class code of 2 to 20 letters or numbers and rejects shorter or longer codes", () => {
    expect(
      lecturerCreateClassSchema.safeParse({ ...validBase, classCode: "AB12" })
        .success,
    ).toBe(true);
    expect(
      lecturerCreateClassSchema.safeParse({ ...validBase, classCode: "A" })
        .success,
    ).toBe(false);
    expect(
      lecturerCreateClassSchema.safeParse({
        ...validBase,
        classCode: "X".repeat(21),
      }).success,
    ).toBe(false);
    // Lowercase handling is intentionally not asserted: whether the schema
    // uppercases or rejects lowercase is only readable from the schema code,
    // which T2 had not delivered at the time this test was written.
  });

  it("bounds the description between 10 and 5000 characters", () => {
    expect(
      lecturerCreateClassSchema.safeParse({
        ...validBase,
        description: "x".repeat(9),
      }).success,
    ).toBe(false);
    expect(
      lecturerCreateClassSchema.safeParse({
        ...validBase,
        description: "x".repeat(10),
      }).success,
    ).toBe(true);
    expect(
      lecturerCreateClassSchema.safeParse({
        ...validBase,
        description: "x".repeat(5000),
      }).success,
    ).toBe(true);
    expect(
      lecturerCreateClassSchema.safeParse({
        ...validBase,
        description: "x".repeat(5001),
      }).success,
    ).toBe(false);
  });

  it("bounds the name between 3 and 120 characters", () => {
    expect(
      lecturerCreateClassSchema.safeParse({ ...validBase, name: "ab" }).success,
    ).toBe(false);
    expect(
      lecturerCreateClassSchema.safeParse({ ...validBase, name: "abc" })
        .success,
    ).toBe(true);
    expect(
      lecturerCreateClassSchema.safeParse({
        ...validBase,
        name: "x".repeat(120),
      }).success,
    ).toBe(true);
    expect(
      lecturerCreateClassSchema.safeParse({
        ...validBase,
        name: "x".repeat(121),
      }).success,
    ).toBe(false);
  });

  it("strips unknown keys instead of smuggling a role through the body", () => {
    const parsed = lecturerCreateClassSchema.parse({
      ...validBase,
      role: "admin",
    });

    expect(parsed).not.toHaveProperty("role");
  });
});

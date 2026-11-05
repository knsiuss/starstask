import { describe, expect, it } from "vitest";

import { parseGradeCsv } from "@/lib/db/grades-publish";

describe("parseGradeCsv", () => {
  it("parses valid CSV", () => {
    const rows = parseGradeCsv(
      "student_id,course_code,score,grade_letter,semester_code,academic_year_code\nUNPAM-123,TI101,85,A,5,2024/2025",
    );
    expect(rows[0]?.studentId).toBe("UNPAM-123");
    expect(rows[0]?.score).toBe(85);
  });
  it("rejects wrong header", () => {
    expect(() => parseGradeCsv("a,b\n1,2")).toThrow();
  });
  it("rejects score > 100", () => {
    expect(() =>
      parseGradeCsv(
        "student_id,course_code,score,grade_letter,semester_code,academic_year_code\nUNPAM-1,TI1,150,A,1,2024/2025",
      ),
    ).toThrow();
  });
  it("rejects >1000 rows", () => {
    const big =
      "student_id,course_code,score,grade_letter,semester_code,academic_year_code\n" +
      Array.from({ length: 1001 }, () => "UNPAM-1,TI1,80,A,1,2024/2025").join("\n");
    expect(() => parseGradeCsv(big)).toThrow();
  });
});

describe("invite defaults", () => {
  it("constants are ADR approved values", async () => {
    const mod = await import("@/lib/db/course-invites");
    expect(mod.INVITE_DEFAULT_MAX_USES).toBe(50);
    expect(mod.INVITE_DEFAULT_EXPIRES_DAYS).toBe(30);
  });
});

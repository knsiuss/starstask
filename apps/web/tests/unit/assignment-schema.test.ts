import { describe, expect, it } from "vitest";

import {
  assignmentCreateSchema,
  assignmentUpdateSchema,
  isSafeHttpUrl,
  listAssignmentsQuerySchema,
  normalizeTags,
} from "@starstask/contracts";

const validInput = {
  title: "Normalization exercise",
  description: "Complete questions 1 to 10 from chapter four.",
  courseName: "Database Systems",
  courseCode: "IF2230",
  deadline: "2026-10-29T16:59:00.000Z",
  tags: ["database", "Database", "sql"],
  referenceUrls: ["https://example.com/brief"],
};

describe("assignmentCreateSchema", () => {
  it("accepts a complete valid payload", () => {
    const result = assignmentCreateSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  it("normalizes tags case-insensitively", () => {
    const result = assignmentCreateSchema.parse(validInput);

    expect(result.tags).toEqual(["database", "sql"]);
  });

  it("rejects a description shorter than ten characters", () => {
    const result = assignmentCreateSchema.safeParse({
      ...validInput,
      description: "too short",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("at least 10");
    }
  });

  it("rejects a deadline without an explicit UTC offset", () => {
    const result = assignmentCreateSchema.safeParse({
      ...validInput,
      deadline: "2026-10-29T23:59",
    });

    expect(result.success).toBe(false);
  });

  it("rejects javascript: reference URLs", () => {
    const result = assignmentCreateSchema.safeParse({
      ...validInput,
      referenceUrls: ["javascript:alert(1)"],
    });

    expect(result.success).toBe(false);
  });

  it("drops empty reference URLs instead of failing", () => {
    const result = assignmentCreateSchema.parse({
      ...validInput,
      referenceUrls: ["", "https://example.com"],
    });

    expect(result.referenceUrls).toEqual(["https://example.com"]);
  });

  it("rejects an academic year outside the YYYY/YYYY format", () => {
    const result = assignmentCreateSchema.safeParse({
      ...validInput,
      academicYear: "2025-2026",
    });

    expect(result.success).toBe(false);
  });
});

describe("assignmentUpdateSchema", () => {
  it("rejects ownership changes from client input", () => {
    const result = assignmentUpdateSchema.safeParse({ user_id: "attacker" });

    expect(result.success).toBe(false);
  });

  it("rejects publication status changes from client input", () => {
    const result = assignmentUpdateSchema.safeParse({ status: "pending" });

    expect(result.success).toBe(false);
  });

  it("accepts a partial payload and keeps omitted fields undefined", () => {
    const result = assignmentUpdateSchema.parse({ title: "Renamed" });

    expect(result.title).toBe("Renamed");
    expect(result.description).toBeUndefined();
  });

  it("allows clearing an optional field with null", () => {
    const result = assignmentUpdateSchema.parse({ deadline: null });

    expect(result.deadline).toBeNull();
  });
});

describe("normalizeTags", () => {
  it("trims, drops empties, and de-duplicates", () => {
    expect(normalizeTags(["  sql ", "SQL", "", "db"])).toEqual(["sql", "db"]);
  });
});

describe("isSafeHttpUrl", () => {
  it.each([
    ["https://example.com", true],
    ["http://example.com/path?q=1", true],
    ["javascript:alert(1)", false],
    ["data:text/html,hi", false],
    ["//example.com", false],
    ["not a url", false],
  ])("classifies %s as %s", (value, expected) => {
    expect(isSafeHttpUrl(value)).toBe(expected);
  });
});

describe("listAssignmentsQuerySchema", () => {
  it("applies safe defaults", () => {
    const query = listAssignmentsQuerySchema.parse({});

    expect(query.sort).toBe("newest");
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(12);
  });

  it("coerces numeric strings", () => {
    const query = listAssignmentsQuerySchema.parse({
      page: "3",
      pageSize: "24",
    });

    expect(query.page).toBe(3);
    expect(query.pageSize).toBe(24);
  });

  it("rejects a page size above the maximum", () => {
    expect(
      listAssignmentsQuerySchema.safeParse({ pageSize: "500" }).success,
    ).toBe(false);
  });

  it("rejects page zero", () => {
    expect(listAssignmentsQuerySchema.safeParse({ page: "0" }).success).toBe(
      false,
    );
  });

  it("rejects an unknown sort value", () => {
    expect(
      listAssignmentsQuerySchema.safeParse({ sort: "random" }).success,
    ).toBe(false);
  });
});

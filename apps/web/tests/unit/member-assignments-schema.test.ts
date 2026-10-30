import { describe, expect, it } from "vitest";

import { memberAssignmentsQuerySchema } from "@starstask/contracts";

describe("memberAssignmentsQuerySchema", () => {
  it("applies the default page and page size", () => {
    expect(memberAssignmentsQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 12,
    });
  });

  it("accepts the supported due windows", () => {
    expect(memberAssignmentsQuerySchema.parse({ due: "soon" }).due).toBe(
      "soon",
    );
    expect(memberAssignmentsQuerySchema.parse({ due: "overdue" }).due).toBe(
      "overdue",
    );
  });

  it("coerces page parameters from the URL", () => {
    const parsed = memberAssignmentsQuerySchema.parse({
      page: "3",
      pageSize: "6",
    });

    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(6);
  });

  it("rejects an unknown due window", () => {
    expect(
      memberAssignmentsQuerySchema.safeParse({ due: "later" }).success,
    ).toBe(false);
  });

  it("rejects out-of-range pagination", () => {
    expect(memberAssignmentsQuerySchema.safeParse({ page: "0" }).success).toBe(
      false,
    );
    expect(
      memberAssignmentsQuerySchema.safeParse({ pageSize: "25" }).success,
    ).toBe(false);
  });
});

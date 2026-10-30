import { describe, expect, it } from "vitest";

import {
  adminApplicationsQuerySchema,
  adminAssignmentQuerySchema,
  adminClassesQuerySchema,
  adminUsersQuerySchema,
} from "@starstask/contracts";

describe("admin user query", () => {
  it("defaults paging and drops a blank search", () => {
    const parsed = adminUsersQuerySchema.parse({ search: "" });

    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.search).toBeUndefined();
    expect(parsed.role).toBe("all");
    expect(parsed.onboarding).toBe("all");
  });

  it("caps the page size", () => {
    expect(adminUsersQuerySchema.safeParse({ pageSize: "50" }).success).toBe(
      true,
    );
    expect(adminUsersQuerySchema.safeParse({ pageSize: "51" }).success).toBe(
      false,
    );
  });

  it("rejects unknown role and onboarding values", () => {
    expect(
      adminUsersQuerySchema.safeParse({ role: "class_admin" }).success,
    ).toBe(false);
    expect(
      adminUsersQuerySchema.safeParse({ onboarding: "half" }).success,
    ).toBe(false);
  });
});

describe("admin class query", () => {
  it("defaults to all statuses and validates the status filter", () => {
    expect(adminClassesQuerySchema.parse({}).status).toBe("all");
    expect(
      adminClassesQuerySchema.safeParse({ status: "archived" }).success,
    ).toBe(true);
    expect(
      adminClassesQuerySchema.safeParse({ status: "deleted" }).success,
    ).toBe(false);
  });
});

describe("admin assignment query", () => {
  it("treats an empty class filter as no filter", () => {
    const parsed = adminAssignmentQuerySchema.parse({ class: "" });

    expect(parsed.class).toBeUndefined();
    expect(parsed.status).toBe("all");
  });

  it("rejects an invalid class id and an unknown status", () => {
    expect(
      adminAssignmentQuerySchema.safeParse({ class: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      adminAssignmentQuerySchema.safeParse({ status: "deleted" }).success,
    ).toBe(false);
  });
});

describe("admin application query", () => {
  it("defaults to the pending queue", () => {
    expect(adminApplicationsQuerySchema.parse({}).status).toBe("pending");
  });

  it("accepts a decision status and rejects an arbitrary one", () => {
    expect(
      adminApplicationsQuerySchema.safeParse({ status: "rejected" }).success,
    ).toBe(true);
    expect(
      adminApplicationsQuerySchema.safeParse({ status: "open" }).success,
    ).toBe(false);
  });
});

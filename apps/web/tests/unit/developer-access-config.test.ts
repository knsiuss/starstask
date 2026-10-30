import { describe, expect, it } from "vitest";

import { developerUsersQuerySchema } from "@starstask/contracts";
import {
  isAllowlistedDeveloperEmail,
  parseDeveloperEmails,
} from "@starstask/shared";

describe("parseDeveloperEmails", () => {
  it("returns missing for absent or blank values", () => {
    expect(parseDeveloperEmails(undefined)).toEqual({ status: "missing" });
    expect(parseDeveloperEmails("")).toEqual({ status: "missing" });
    expect(parseDeveloperEmails("  ,  ")).toEqual({ status: "missing" });
  });

  it("normalizes, trims, and deduplicates entries", () => {
    expect(
      parseDeveloperEmails(
        " Dev@Example.com,dev@example.com , ops@example.com ",
      ),
    ).toEqual({
      status: "ok",
      emails: ["dev@example.com", "ops@example.com"],
    });
  });

  it("invalidates the whole list when one entry is malformed", () => {
    expect(parseDeveloperEmails("dev@example.com,not-an-email")).toEqual({
      status: "invalid",
    });
    expect(parseDeveloperEmails("dev@example.com,another@bad")).toEqual({
      status: "invalid",
    });
  });

  it("rejects entries that are too long", () => {
    const longLocal = "a".repeat(250);

    expect(parseDeveloperEmails(`${longLocal}@example.com`)).toEqual({
      status: "invalid",
    });
  });

  it("matches case-insensitively and fails closed on non-ok configs", () => {
    const allowlist = parseDeveloperEmails("dev@example.com");

    expect(isAllowlistedDeveloperEmail("DEV@EXAMPLE.COM", allowlist)).toBe(
      true,
    );
    expect(isAllowlistedDeveloperEmail("other@example.com", allowlist)).toBe(
      false,
    );
    expect(
      isAllowlistedDeveloperEmail("dev@example.com", { status: "missing" }),
    ).toBe(false);
    expect(
      isAllowlistedDeveloperEmail("dev@example.com", { status: "invalid" }),
    ).toBe(false);
    expect(isAllowlistedDeveloperEmail(null, allowlist)).toBe(false);
  });
});

describe("developerUsersQuerySchema", () => {
  it("provides bounded defaults", () => {
    expect(developerUsersQuerySchema.parse({})).toEqual({
      search: undefined,
      sort: "created_at",
      direction: "desc",
      page: 1,
      pageSize: 25,
    });
  });

  it("trims and normalizes accepted filters", () => {
    expect(
      developerUsersQuerySchema.parse({
        search: "  Dev Name ",
        sort: "last_sign_in_at",
        direction: "asc",
        page: "2",
        pageSize: "50",
      }),
    ).toEqual({
      search: "Dev Name",
      sort: "last_sign_in_at",
      direction: "asc",
      page: 2,
      pageSize: 50,
    });
  });

  it("rejects unknown sorts and out-of-range pagination", () => {
    expect(
      developerUsersQuerySchema.safeParse({ sort: "password" }).success,
    ).toBe(false);
    expect(developerUsersQuerySchema.safeParse({ sort: "email" }).success).toBe(
      false,
    );
    expect(
      developerUsersQuerySchema.safeParse({ pageSize: "101" }).success,
    ).toBe(false);
    expect(developerUsersQuerySchema.safeParse({ page: "1001" }).success).toBe(
      false,
    );
    expect(
      developerUsersQuerySchema.safeParse({ direction: "sideways" }).success,
    ).toBe(false);
  });
});

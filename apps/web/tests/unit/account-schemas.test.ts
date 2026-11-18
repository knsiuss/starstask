import { describe, expect, it } from "vitest";

import {
  deactivateAccountSchema,
  deleteAccountSchema,
  reactivateAccountSchema,
} from "@/features/account/account-schemas";

describe("deactivateAccountSchema", () => {
  it("requires the literal DEACTIVATE confirmation", () => {
    expect(
      deactivateAccountSchema.safeParse({ confirmation: "DEACTIVATE" }).success,
    ).toBe(true);
    expect(
      deactivateAccountSchema.safeParse({ confirmation: "deactivate" }).success,
    ).toBe(false);
    expect(
      deactivateAccountSchema.safeParse({ confirmation: "" }).success,
    ).toBe(false);
    expect(deactivateAccountSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a missing reason", () => {
    const parsed = deactivateAccountSchema.parse({
      confirmation: "DEACTIVATE",
    });

    expect(parsed.reason).toBeUndefined();
  });

  it("trims the reason and accepts a short note", () => {
    const parsed = deactivateAccountSchema.parse({
      confirmation: "DEACTIVATE",
      reason: "  taking a break  ",
    });

    expect(parsed.reason).toBe("taking a break");
  });

  it("rejects a reason longer than 500 characters", () => {
    expect(
      deactivateAccountSchema.safeParse({
        confirmation: "DEACTIVATE",
        reason: "x".repeat(501),
      }).success,
    ).toBe(false);
    expect(
      deactivateAccountSchema.safeParse({
        confirmation: "DEACTIVATE",
        reason: "x".repeat(500),
      }).success,
    ).toBe(true);
  });
});

describe("deleteAccountSchema", () => {
  it("requires the literal DELETE confirmation", () => {
    expect(
      deleteAccountSchema.safeParse({
        confirmation: "DELETE",
        email: "user@example.com",
      }).success,
    ).toBe(true);
    expect(
      deleteAccountSchema.safeParse({
        confirmation: "delete",
        email: "user@example.com",
      }).success,
    ).toBe(false);
    expect(
      deleteAccountSchema.safeParse({ email: "user@example.com" }).success,
    ).toBe(false);
  });

  it("requires a valid email", () => {
    expect(
      deleteAccountSchema.safeParse({
        confirmation: "DELETE",
        email: "not-an-email",
      }).success,
    ).toBe(false);
    expect(
      deleteAccountSchema.safeParse({
        confirmation: "DELETE",
        email: "",
      }).success,
    ).toBe(false);
    expect(
      deleteAccountSchema.safeParse({ confirmation: "DELETE" }).success,
    ).toBe(false);
  });

  it("normalises the email to lowercase and trimmed", () => {
    const parsed = deleteAccountSchema.parse({
      confirmation: "DELETE",
      email: "  User@Example.COM  ",
    });

    expect(parsed.email).toBe("user@example.com");
  });

  it("rejects a reason longer than 500 characters", () => {
    expect(
      deleteAccountSchema.safeParse({
        confirmation: "DELETE",
        email: "user@example.com",
        reason: "x".repeat(501),
      }).success,
    ).toBe(false);
    expect(
      deleteAccountSchema.safeParse({
        confirmation: "DELETE",
        email: "user@example.com",
        reason: "x".repeat(500),
      }).success,
    ).toBe(true);
  });
});

describe("reactivateAccountSchema", () => {
  it("accepts an empty object", () => {
    expect(reactivateAccountSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a non-object body", () => {
    expect(reactivateAccountSchema.safeParse(null).success).toBe(false);
    expect(reactivateAccountSchema.safeParse(undefined).success).toBe(false);
    expect(reactivateAccountSchema.safeParse("reactivate").success).toBe(false);
    expect(reactivateAccountSchema.safeParse(42).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { markNotificationsReadSchema } from "@starstask/contracts";

const ID = "6c1f0f2e-6a3a-4d18-9d7c-3f2b1e2c8a11";

describe("markNotificationsReadSchema", () => {
  it("accepts a request that marks everything read", () => {
    const parsed = markNotificationsReadSchema.parse({ all: true });

    expect(parsed).toEqual({ all: true });
  });

  it("accepts a list of ids", () => {
    const parsed = markNotificationsReadSchema.parse({ ids: [ID] });

    expect(parsed).toEqual({ ids: [ID] });
  });

  it("rejects an empty body", () => {
    expect(markNotificationsReadSchema.safeParse({}).success).toBe(false);
  });

  it("rejects all set to false with no ids", () => {
    expect(markNotificationsReadSchema.safeParse({ all: false }).success).toBe(
      false,
    );
  });

  it("rejects an empty id list", () => {
    expect(markNotificationsReadSchema.safeParse({ ids: [] }).success).toBe(
      false,
    );
  });

  it("rejects more than one hundred ids", () => {
    const ids = Array.from({ length: 101 }, () => ID);

    expect(markNotificationsReadSchema.safeParse({ ids }).success).toBe(false);
  });

  it("rejects a malformed id", () => {
    expect(
      markNotificationsReadSchema.safeParse({ ids: ["not-a-uuid"] }).success,
    ).toBe(false);
  });

  it("rejects unknown fields", () => {
    expect(
      markNotificationsReadSchema.safeParse({ all: true, userId: ID }).success,
    ).toBe(false);
  });
});

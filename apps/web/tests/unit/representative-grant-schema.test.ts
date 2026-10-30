import { describe, expect, it } from "vitest";

import { representativeGrantSchema } from "@starstask/contracts";

const VALID_CLASS_ID = "0b8f6c9e-1c2d-4a3b-8f2e-5d6c7b8a9f01";

describe("representativeGrantSchema", () => {
  it("accepts a class id", () => {
    const result = representativeGrantSchema.safeParse({
      classId: VALID_CLASS_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid class id", () => {
    const result = representativeGrantSchema.safeParse({
      classId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown keys", () => {
    const result = representativeGrantSchema.safeParse({
      classId: VALID_CLASS_ID,
      statement: "extra",
    });

    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { parseFeatureFlag } from "@/lib/config/features";

describe("parseFeatureFlag", () => {
  it("defaults to enabled when the variable is absent", () => {
    expect(parseFeatureFlag(undefined)).toBe(true);
  });

  it.each(["", "  ", "1", "true", "on", "yes", "enabled", "anything"])(
    "stays enabled for %j",
    (value) => {
      expect(parseFeatureFlag(value)).toBe(true);
    },
  );

  it.each(["0", "false", "FALSE", " off ", "No", "disabled"])(
    "turns off for %j",
    (value) => {
      expect(parseFeatureFlag(value)).toBe(false);
    },
  );
});

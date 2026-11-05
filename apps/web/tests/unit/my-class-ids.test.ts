import { describe, expect, it } from "vitest";

import { summarizeClassIds } from "@/lib/identity/get-my-class-ids";

describe("summarizeClassIds", () => {
  it("returns an empty list for no rows", () => {
    expect(summarizeClassIds([])).toEqual([]);
  });

  it("dedupes repeat rows and drops null ids", () => {
    expect(
      summarizeClassIds([
        { class_id: "b" },
        { class_id: "a" },
        { class_id: "b" },
        { class_id: null },
      ]),
    ).toEqual(["a", "b"]);
  });

  it("sorts ids for stable rendering", () => {
    expect(
      summarizeClassIds([{ class_id: "zeta" }, { class_id: "alpha" }]),
    ).toEqual(["alpha", "zeta"]);
  });
});

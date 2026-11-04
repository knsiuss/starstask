import { describe, expect, it } from "vitest";

import {
  INIT_STAGES,
  shouldShowJoinStep,
  type InitStage,
} from "@/lib/onboarding/init-flow";

describe("initialization stages", () => {
  it("covers initialize, sync, and almost ready in order", () => {
    expect(INIT_STAGES.map((stage) => stage.id)).toEqual([
      "initialize",
      "sync",
      "almostReady",
    ] satisfies InitStage[]);
  });
});

describe("shouldShowJoinStep", () => {
  it("shows the step when no class was typed", () => {
    expect(shouldShowJoinStep(null)).toBe(true);
  });

  it("hides the step when the save already placed the student", () => {
    expect(
      shouldShowJoinStep({
        status: "joined",
        classId: "11111111-1111-1111-1111-111111111111",
        slug: "if-24-01",
        name: "IF 24 01",
      }),
    ).toBe(false);
    expect(
      shouldShowJoinStep({
        status: "already_member",
        classId: "11111111-1111-1111-1111-111111111111",
        slug: "if-24-01",
        name: "IF 24 01",
      }),
    ).toBe(false);
  });

  it("shows the step for outcomes that left the student without a class", () => {
    expect(shouldShowJoinStep({ status: "no_match" })).toBe(true);
    expect(
      shouldShowJoinStep({
        status: "ambiguous",
        candidates: [{ id: "a", slug: "a", name: "A" }],
      }),
    ).toBe(true);
    expect(
      shouldShowJoinStep({
        status: "blocked_by_policy",
        classId: "11111111-1111-1111-1111-111111111111",
        slug: "if-24-01",
        name: "IF 24 01",
      }),
    ).toBe(true);
  });
});

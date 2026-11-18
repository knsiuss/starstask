import { describe, expect, it } from "vitest";

import {
  calculateOfferingBapProgress,
  formatBelowTargetPace,
  formatRemainingToTarget,
  summarizeBapProgress,
  type BapOfferingInput,
} from "@/lib/lecturer/bap-progress";

function offering(overrides: Partial<BapOfferingInput> = {}): BapOfferingInput {
  return {
    offeringId: "off-1",
    classId: "cls-1",
    className: "Class A",
    classSlug: "class-a",
    courseName: "Basis Data",
    meetings: [],
    ...overrides,
  };
}

function closedMeetings(count: number, targetMeetings = 14) {
  return Array.from({ length: count }, (_, index) => ({
    status: "closed",
    bapTopic: `Meeting ${index + 1}`,
    targetMeetings,
  }));
}

describe("formatBelowTargetPace", () => {
  it("renders the warning line for N>0 with singular course", () => {
    expect(formatBelowTargetPace(1)).toBe("Below target pace: 1 course");
  });

  it("renders the warning line for N>0 with plural courses", () => {
    expect(formatBelowTargetPace(3)).toBe("Below target pace: 3 courses");
  });

  it("clamps negative counts to zero instead of hiding the signal silently", () => {
    expect(formatBelowTargetPace(-2)).toBe("Below target pace: 0 courses");
  });
});

describe("formatRemainingToTarget", () => {
  it("renders remaining meetings with singular meeting", () => {
    expect(formatRemainingToTarget(1)).toBe("1 meeting to target");
  });

  it("renders remaining meetings with plural meetings", () => {
    expect(formatRemainingToTarget(6)).toBe("6 meetings to target");
  });

  it("never reports a negative remaining count", () => {
    expect(formatRemainingToTarget(0)).toBe("0 meetings to target");
    expect(formatRemainingToTarget(-4)).toBe("0 meetings to target");
  });
});

describe("below-target pace summary", () => {
  it("counts below-target courses and surfaces the remaining gap per offering", () => {
    const summary = summarizeBapProgress([
      offering({
        offeringId: "off-behind",
        courseName: "Algoritma",
        meetings: closedMeetings(5),
      }),
      offering({
        offeringId: "off-ontrack",
        courseName: "Basis Data",
        meetings: closedMeetings(14),
      }),
      offering({
        offeringId: "off-partial",
        courseName: "Jaringan",
        meetings: closedMeetings(9),
      }),
    ]);

    expect(summary.belowTargetCount).toBe(2);
    expect(formatBelowTargetPace(summary.belowTargetCount)).toBe(
      "Below target pace: 2 courses",
    );

    const behind = summary.offerings.filter((item) => item.isBelowTarget);
    expect(behind.map((item) => item.offeringId)).toEqual([
      "off-behind",
      "off-partial",
    ]);
    expect(
      behind.map((item) => formatRemainingToTarget(item.remainingToTarget)),
    ).toEqual(["9 meetings to target", "5 meetings to target"]);
  });

  it("reports zero below-target courses when every offering met target", () => {
    const summary = summarizeBapProgress([
      offering({ offeringId: "off-a", meetings: closedMeetings(14) }),
      offering({
        offeringId: "off-b",
        courseName: "Struktur Data",
        meetings: closedMeetings(16, 16),
      }),
    ]);

    expect(summary.belowTargetCount).toBe(0);
    expect(
      summary.offerings.every((item) => item.isBelowTarget === false),
    ).toBe(true);
  });

  it("keeps below-target offerings sorted ahead of on-pace ones", () => {
    const summary = summarizeBapProgress([
      offering({
        offeringId: "off-onpace",
        courseName: "Algoritma",
        meetings: closedMeetings(14),
      }),
      offering({
        offeringId: "off-behind",
        courseName: "Basis Data",
        meetings: closedMeetings(3),
      }),
    ]);

    expect(summary.offerings[0]?.offeringId).toBe("off-behind");
    expect(summary.offerings[0]?.isBelowTarget).toBe(true);
  });

  it("caps progressPercent at 100 while still reporting zero remaining meetings", () => {
    const progress = calculateOfferingBapProgress(
      offering({ meetings: closedMeetings(20, 14) }),
    );

    expect(progress.progressPercent).toBe(100);
    expect(progress.remainingToTarget).toBe(0);
    expect(progress.isBelowTarget).toBe(false);
    expect(formatRemainingToTarget(progress.remainingToTarget)).toBe(
      "0 meetings to target",
    );
  });
});

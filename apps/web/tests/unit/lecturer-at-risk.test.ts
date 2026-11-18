import { describe, expect, it } from "vitest";

import {
  summarizeAtRisk,
  type AtRiskSubjectInput,
} from "@/lib/lecturer/at-risk";

function subject(
  overrides: Partial<AtRiskSubjectInput> = {},
): AtRiskSubjectInput {
  return {
    classSlug: "class-a",
    className: "Class A",
    subjectName: "Subject A",
    subjectId: "subject-a",
    students: [],
    ...overrides,
  };
}

describe("summarizeAtRisk", () => {
  it("returns zero counts when there are no subjects", () => {
    const summary = summarizeAtRisk({ perSubject: [] });

    expect(summary.atRiskCount).toBe(0);
    expect(summary.byClass).toEqual([]);
  });

  it("ignores subjects where no student has eligible meetings", () => {
    const summary = summarizeAtRisk({
      perSubject: [
        subject({
          students: [
            { percentage: 40, eligible: 0 },
            { percentage: null, eligible: 0 },
          ],
        }),
      ],
    });

    expect(summary.atRiskCount).toBe(0);
    expect(summary.byClass).toEqual([]);
  });

  it("treats exactly 75% as not at risk", () => {
    const summary = summarizeAtRisk({
      perSubject: [
        subject({
          students: [{ percentage: 75, eligible: 10 }],
        }),
      ],
    });

    expect(summary.atRiskCount).toBe(0);
    expect(summary.byClass).toEqual([
      {
        classSlug: "class-a",
        className: "Class A",
        subjectName: "Subject A",
        atRiskStudentCount: 0,
      },
    ]);
  });

  it("treats 74.9% as at risk", () => {
    const summary = summarizeAtRisk({
      perSubject: [
        subject({
          students: [{ percentage: 74.9, eligible: 10 }],
        }),
      ],
    });

    expect(summary.atRiskCount).toBe(1);
    expect(summary.byClass[0]?.atRiskStudentCount).toBe(1);
  });

  it("ignores students with null percentage even when eligible", () => {
    const summary = summarizeAtRisk({
      perSubject: [
        subject({
          students: [{ percentage: null, eligible: 10 }],
        }),
      ],
    });

    expect(summary.atRiskCount).toBe(0);
    expect(summary.byClass[0]?.atRiskStudentCount).toBe(0);
  });

  it("aggregates counts across subjects and classes", () => {
    const summary = summarizeAtRisk({
      perSubject: [
        subject({
          classSlug: "class-a",
          className: "Class A",
          subjectName: "Subject A",
          students: [
            { percentage: 50, eligible: 10 },
            { percentage: 80, eligible: 10 },
          ],
        }),
        subject({
          classSlug: "class-b",
          className: "Class B",
          subjectName: "Subject B",
          subjectId: "subject-b",
          students: [
            { percentage: 10, eligible: 5 },
            { percentage: 20, eligible: 5 },
            { percentage: 90, eligible: 5 },
          ],
        }),
      ],
    });

    expect(summary.atRiskCount).toBe(3);
    const byKey = new Map(
      summary.byClass.map((row) => [row.subjectName, row.atRiskStudentCount]),
    );
    expect(byKey.get("Subject A")).toBe(1);
    expect(byKey.get("Subject B")).toBe(2);
  });

  it("sorts subjects by at-risk count descending", () => {
    const summary = summarizeAtRisk({
      perSubject: [
        subject({
          classSlug: "low",
          className: "Low",
          subjectName: "Low subject",
          subjectId: "low",
          students: [{ percentage: 50, eligible: 10 }],
        }),
        subject({
          classSlug: "high",
          className: "High",
          subjectName: "High subject",
          subjectId: "high",
          students: [
            { percentage: 50, eligible: 10 },
            { percentage: 60, eligible: 10 },
            { percentage: 70, eligible: 10 },
          ],
        }),
      ],
    });

    expect(summary.byClass.map((row) => row.classSlug)).toEqual([
      "high",
      "low",
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { gradeScoreSchema, gradeWeightsSchema } from "@starstask/contracts";

import {
  DEFAULT_GRADE_WEIGHTS,
  calculateAttendanceEligibility,
  computeWeightedFinalGrade,
  validateGradeWeights,
} from "@/lib/attendance/eligibility";

describe("calculateAttendanceEligibility", () => {
  it("marks exact 75% attendance as eligible with zero remaining absences", () => {
    const result = calculateAttendanceEligibility(12, 16);

    expect(result).toEqual({
      percentage: 75,
      isEligible: true,
      remainingAllowedAbsences: 0,
      attendedCount: 12,
      totalMeetings: 16,
    });
  });

  it("marks 74.9% attendance as ineligible", () => {
    const result = calculateAttendanceEligibility(749, 1000);

    expect(result.percentage).toBe(74.9);
    expect(result.isEligible).toBe(false);
    expect(result.remainingAllowedAbsences).toBe(0);
  });

  it("computes remaining allowed absences when above the threshold", () => {
    const result = calculateAttendanceEligibility(14, 16);

    expect(result.percentage).toBe(87.5);
    expect(result.isEligible).toBe(true);
    expect(result.remainingAllowedAbsences).toBe(2);
  });

  it("handles zero meetings safely without marking ineligible", () => {
    const result = calculateAttendanceEligibility(0, 0);

    expect(result).toEqual({
      percentage: 0,
      isEligible: true,
      remainingAllowedAbsences: 0,
      attendedCount: 0,
      totalMeetings: 0,
    });
  });

  it("throws when threshold is outside (0, 1]", () => {
    expect(() => calculateAttendanceEligibility(3, 4, 0)).toThrow();
    expect(() => calculateAttendanceEligibility(3, 4, 1.2)).toThrow();
  });
});

describe("gradeWeightsSchema and validateGradeWeights", () => {
  it("accepts weights summing to 100%", () => {
    expect(gradeWeightsSchema.safeParse(DEFAULT_GRADE_WEIGHTS).success).toBe(
      true,
    );
    expect(validateGradeWeights(DEFAULT_GRADE_WEIGHTS)).toEqual({
      valid: true,
      total: 100,
    });
  });

  it("rejects weights whose sum is not 100%", () => {
    const under = validateGradeWeights({
      absensi: 10,
      tugas: 20,
      uts: 30,
      uas: 39,
    });
    const over = validateGradeWeights({
      absensi: 10,
      tugas: 20,
      uts: 30,
      uas: 41,
    });

    expect(under.valid).toBe(false);
    expect(under.total).toBe(99);
    expect(over.valid).toBe(false);
    expect(over.total).toBe(101);
  });
});

describe("gradeScoreSchema and computeWeightedFinalGrade", () => {
  it("enforces 0 to 100 bounds on scores", () => {
    expect(gradeScoreSchema.safeParse(0).success).toBe(true);
    expect(gradeScoreSchema.safeParse(100).success).toBe(true);
    expect(gradeScoreSchema.safeParse(85.5).success).toBe(true);
    expect(gradeScoreSchema.safeParse(-0.1).success).toBe(false);
    expect(gradeScoreSchema.safeParse(100.1).success).toBe(false);
  });

  it("computes the weighted final grade accurately", () => {
    const finalGrade = computeWeightedFinalGrade(
      { absensi: 100, tugas: 80, uts: 75, uas: 90 },
      DEFAULT_GRADE_WEIGHTS,
    );

    expect(finalGrade).toBe(84.5);
  });

  it("throws when scores are out of 0-100 range or weights do not sum to 100", () => {
    expect(() =>
      computeWeightedFinalGrade(
        { absensi: 100, tugas: -1, uts: 75, uas: 90 },
        DEFAULT_GRADE_WEIGHTS,
      ),
    ).toThrow();

    expect(() =>
      computeWeightedFinalGrade(
        { absensi: 100, tugas: 80, uts: 101, uas: 90 },
        DEFAULT_GRADE_WEIGHTS,
      ),
    ).toThrow();

    expect(() =>
      computeWeightedFinalGrade(
        { absensi: 100, tugas: 80, uts: 75, uas: 90 },
        { absensi: 10, tugas: 20, uts: 30, uas: 30 },
      ),
    ).toThrow();
  });
});

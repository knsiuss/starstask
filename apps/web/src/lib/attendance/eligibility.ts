import {
  gradeWeightsSchema,
  weightedGradeScoresSchema,
  type GradeWeights,
  type WeightedGradeScores,
} from "@starstask/contracts";

export const DEFAULT_ATTENDANCE_THRESHOLD = 0.75;

export const DEFAULT_GRADE_WEIGHTS: GradeWeights = {
  absensi: 10,
  tugas: 20,
  uts: 30,
  uas: 40,
};

export type AttendanceEligibilityResult = {
  percentage: number;
  isEligible: boolean;
  remainingAllowedAbsences: number;
  attendedCount: number;
  totalMeetings: number;
};

export type GradeWeightValidationResult = {
  valid: boolean;
  total: number;
  error?: string;
};

/**
 * Computes exam eligibility against a minimum attendance ratio (default 75%).
 * When no meetings have occurred yet (totalMeetings <= 0), the student is not
 * marked ineligible and has 0 remaining allowed absences.
 */
export function calculateAttendanceEligibility(
  attendedCount: number,
  totalMeetings: number,
  threshold: number = DEFAULT_ATTENDANCE_THRESHOLD,
): AttendanceEligibilityResult {
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    throw new Error("Attendance threshold must be between 0 and 1");
  }

  if (!Number.isFinite(totalMeetings) || totalMeetings <= 0) {
    return {
      percentage: 0,
      isEligible: true,
      remainingAllowedAbsences: 0,
      attendedCount: 0,
      totalMeetings: 0,
    };
  }

  const safeAttended = Math.max(
    0,
    Math.min(Number.isFinite(attendedCount) ? attendedCount : 0, totalMeetings),
  );
  const ratio = safeAttended / totalMeetings;
  const percentage = Math.round(ratio * 1000) / 10;
  const maxAllowedAbsences = Math.floor(totalMeetings * (1 - threshold));
  const currentAbsences = totalMeetings - safeAttended;

  return {
    percentage,
    isEligible: ratio >= threshold,
    remainingAllowedAbsences: Math.max(0, maxAllowedAbsences - currentAbsences),
    attendedCount: safeAttended,
    totalMeetings,
  };
}

/**
 * Validates that grading weights are each within 0-100 and sum to 100%.
 */
export function validateGradeWeights(
  weights: GradeWeights,
): GradeWeightValidationResult {
  const total = weights.absensi + weights.tugas + weights.uts + weights.uas;
  const parsed = gradeWeightsSchema.safeParse(weights);

  if (!parsed.success) {
    return {
      valid: false,
      total,
      error: parsed.error.issues[0]?.message ?? "Invalid grade weights",
    };
  }

  return {
    valid: true,
    total: 100,
  };
}

/**
 * Computes the weighted final grade (0-100, rounded to 2 decimal places)
 * after enforcing 0-100 score bounds and 100% total weight.
 */
export function computeWeightedFinalGrade(
  scores: WeightedGradeScores,
  weights: GradeWeights,
): number {
  const parsedScores = weightedGradeScoresSchema.safeParse(scores);

  if (!parsedScores.success) {
    throw new Error(
      parsedScores.error.issues[0]?.message ??
        "Scores must be between 0 and 100",
    );
  }

  const weightCheck = validateGradeWeights(weights);

  if (!weightCheck.valid) {
    throw new Error(weightCheck.error ?? "Grade weights must sum to 100%");
  }

  const raw =
    (parsedScores.data.absensi * weights.absensi +
      parsedScores.data.tugas * weights.tugas +
      parsedScores.data.uts * weights.uts +
      parsedScores.data.uas * weights.uas) /
    100;

  return Math.round(raw * 100) / 100;
}

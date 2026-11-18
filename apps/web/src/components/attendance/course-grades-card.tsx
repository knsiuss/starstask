import type { GradeWeights } from "@starstask/contracts";
import { Award } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  calculateAttendanceEligibility,
  computeWeightedFinalGrade,
  validateGradeWeights,
} from "@/lib/attendance/eligibility";

type CourseGradesCardProps = {
  tugas: number | null;
  uts: number | null;
  uas: number | null;
  attendedCount?: number;
  totalMeetings?: number;
  weights?: GradeWeights;
};

const GRADE_ITEMS = [
  { key: "tugas", label: "Tugas" },
  { key: "uts", label: "UTS" },
  { key: "uas", label: "UAS" },
] as const;

function formatScore(score: number | null): string {
  if (score === null) {
    return "Pending";
  }

  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/**
 * Displays the signed-in student's Tugas, UTS, and UAS scores for one course.
 */
export function CourseGradesCard({
  tugas,
  uts,
  uas,
  attendedCount,
  totalMeetings,
  weights,
}: CourseGradesCardProps) {
  const scores: Record<(typeof GRADE_ITEMS)[number]["key"], number | null> = {
    tugas,
    uts,
    uas,
  };

  const gradedValues = [tugas, uts, uas].filter(
    (value): value is number => value !== null,
  );
  const eligibility =
    attendedCount !== undefined && totalMeetings !== undefined
      ? calculateAttendanceEligibility(attendedCount, totalMeetings)
      : null;

  const hasValidWeights =
    weights !== undefined && validateGradeWeights(weights).valid;

  const weightedFinal =
    hasValidWeights &&
    eligibility !== null &&
    eligibility.totalMeetings > 0 &&
    tugas !== null &&
    uts !== null &&
    uas !== null
      ? computeWeightedFinalGrade(
          {
            absensi: eligibility.percentage,
            tugas,
            uts,
            uas,
          },
          weights,
        )
      : null;

  const average =
    weightedFinal !== null
      ? weightedFinal
      : gradedValues.length > 0
        ? gradedValues.reduce((sum, value) => sum + value, 0) /
          gradedValues.length
        : null;

  return (
    <section
      aria-labelledby="course-grades-heading"
      className="border-border bg-surface flex flex-col justify-between rounded-xl border p-5"
    >
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="course-grades-heading"
                className="text-muted-foreground text-sm font-medium"
              >
                Course grades
              </h2>
              {eligibility && eligibility.totalMeetings > 0 ? (
                <Badge variant={eligibility.isEligible ? "success" : "danger"}>
                  {eligibility.isEligible
                    ? "Exam eligible"
                    : "Below 75% attendance"}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                {average === null ? "No grades" : average.toFixed(1)}
              </span>
              <span className="text-muted-foreground text-sm">
                {weightedFinal !== null && weights
                  ? `weighted final (${weights.absensi}/${weights.tugas}/${weights.uts}/${weights.uas})`
                  : gradedValues.length === 0
                    ? "awaiting scores"
                    : `${gradedValues.length} of 3 components graded`}
              </span>
            </p>
          </div>
          <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <Award
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>
        </div>

        <dl className="border-border bg-border mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border">
          {GRADE_ITEMS.map((item) => {
            const value = scores[item.key];

            return (
              <div
                key={item.key}
                className="bg-surface min-w-0 px-3 py-3"
              >
                <dt className="text-muted-foreground text-xs font-medium">
                  {item.label}
                </dt>
                <dd
                  className={
                    value === null
                      ? "text-muted-foreground mt-1 text-sm font-medium"
                      : "text-foreground mt-0.5 text-xl font-semibold tabular-nums"
                  }
                >
                  {formatScore(value)}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      {eligibility && eligibility.totalMeetings > 0 ? (
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          {eligibility.isEligible
            ? `Attendance ${eligibility.percentage}% (${eligibility.remainingAllowedAbsences} allowed ${eligibility.remainingAllowedAbsences === 1 ? "absence" : "absences"} remaining).`
            : `Attendance ${eligibility.percentage}% is below the 75% minimum required for UAS eligibility.`}
        </p>
      ) : (
        <p className="text-muted-foreground mt-3 hidden text-xs leading-relaxed sm:block">
          Tugas, UTS, and UAS scores are recorded by your class admin or
          lecturer on the course attendance sheet.
        </p>
      )}
    </section>
  );
}

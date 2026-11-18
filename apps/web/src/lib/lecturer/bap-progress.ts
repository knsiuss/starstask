import {
  ATTENDANCE_TARGET_MEETINGS_DEFAULT,
  ATTENDANCE_TARGET_MEETINGS_MAX,
  ATTENDANCE_TARGET_MEETINGS_MIN,
} from "@starstask/contracts";
import { pluralize } from "@starstask/shared";

export type BapMeetingInput = {
  status: string;
  bapTopic?: string | null;
  targetMeetings?: number | null;
};

export type BapOfferingInput = {
  offeringId: string;
  subjectId?: string | null;
  classId: string;
  className: string;
  classSlug: string;
  courseName: string;
  meetings: readonly BapMeetingInput[];
};

export type BapOfferingProgress = {
  offeringId: string;
  subjectId: string | null;
  classId: string;
  className: string;
  classSlug: string;
  courseName: string;
  meetingsHeld: number;
  meetingsWithBap: number;
  missingBapCount: number;
  targetMeetings: number;
  remainingToTarget: number;
  isBelowTarget: boolean;
  progressPercent: number;
};

export type LecturerBapSummary = {
  offerings: BapOfferingProgress[];
  totalMeetingsHeld: number;
  totalMeetingsWithBap: number;
  totalMissingBap: number;
  belowTargetCount: number;
};

/** Muted secondary line for an offering that is behind its meeting target. */
export function formatRemainingToTarget(remainingToTarget: number): string {
  const remaining = Math.max(0, Math.trunc(remainingToTarget));
  return `${remaining} ${pluralize(remaining, "meeting")} to target`;
}

/** Warning line shown when at least one offering is behind pace. */
export function formatBelowTargetPace(belowTargetCount: number): string {
  const count = Math.max(0, Math.trunc(belowTargetCount));
  return `Below target pace: ${count} ${pluralize(count, "course")}`;
}

function resolveTargetMeetings(meetings: readonly BapMeetingInput[]): number {
  const configured = meetings.reduce((max, meeting) => {
    if (
      typeof meeting.targetMeetings === "number" &&
      Number.isFinite(meeting.targetMeetings)
    ) {
      return Math.max(max, Math.trunc(meeting.targetMeetings));
    }

    return max;
  }, 0);

  if (configured <= 0) {
    return ATTENDANCE_TARGET_MEETINGS_DEFAULT;
  }

  return Math.min(
    ATTENDANCE_TARGET_MEETINGS_MAX,
    Math.max(ATTENDANCE_TARGET_MEETINGS_MIN, configured),
  );
}

/**
 * Summarizes meeting count progress against the 14-16 meeting semester target
 * and BAP topic completion for one course offering.
 */
export function calculateOfferingBapProgress(
  input: BapOfferingInput,
): BapOfferingProgress {
  const heldMeetings = input.meetings.filter(
    (meeting) => meeting.status === "open" || meeting.status === "closed",
  );
  const meetingsHeld = heldMeetings.length;
  const meetingsWithBap = heldMeetings.filter(
    (meeting) =>
      typeof meeting.bapTopic === "string" &&
      meeting.bapTopic.trim().length > 0,
  ).length;
  const targetMeetings = resolveTargetMeetings(input.meetings);
  const missingBapCount = Math.max(0, meetingsHeld - meetingsWithBap);
  const remainingToTarget = Math.max(0, targetMeetings - meetingsHeld);
  const progressPercent = Math.min(
    100,
    Math.round((meetingsHeld / targetMeetings) * 100),
  );

  return {
    offeringId: input.offeringId,
    subjectId: input.subjectId ?? null,
    classId: input.classId,
    className: input.className,
    classSlug: input.classSlug,
    courseName: input.courseName,
    meetingsHeld,
    meetingsWithBap,
    missingBapCount,
    targetMeetings,
    remainingToTarget,
    isBelowTarget: meetingsHeld < targetMeetings,
    progressPercent,
  };
}

/** Aggregates BAP & meeting-count progress across all offerings of a lecturer. */
export function summarizeBapProgress(
  offerings: readonly BapOfferingInput[],
): LecturerBapSummary {
  const items = offerings
    .map(calculateOfferingBapProgress)
    .sort((left, right) => {
      if (left.isBelowTarget !== right.isBelowTarget) {
        return left.isBelowTarget ? -1 : 1;
      }

      return left.courseName.localeCompare(right.courseName);
    });

  return {
    offerings: items,
    totalMeetingsHeld: items.reduce((sum, item) => sum + item.meetingsHeld, 0),
    totalMeetingsWithBap: items.reduce(
      (sum, item) => sum + item.meetingsWithBap,
      0,
    ),
    totalMissingBap: items.reduce((sum, item) => sum + item.missingBapCount, 0),
    belowTargetCount: items.filter((item) => item.isBelowTarget).length,
  };
}

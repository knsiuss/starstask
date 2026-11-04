// Shared onboarding initialization helpers.
//
// Every decision here is pure and unit-tested: the Welcome screen only
// advances its stages when a real operation resolves, and the join step is
// shown exactly when the save attempt left the student without a class.

import type { ClassJoinResult } from "@starstask/contracts";

export type InitStage = "initialize" | "sync" | "almostReady";

export const INIT_STAGES: Array<{ id: InitStage; label: string }> = [
  { id: "initialize", label: "Initialize" },
  { id: "sync", label: "Sync Data" },
  { id: "almostReady", label: "Almost Ready" },
];

/**
 * Whether the dedicated "Join your class" step still has work to do.
 *
 * Already joined (or already a member) means the save already placed the
 * student, so the step would only repeat the attempt. Every other outcome
 * (nothing typed, no match, ambiguous, or invitation-only) gets the step,
 * where the student can retry or skip.
 */
export function shouldShowJoinStep(classJoin: ClassJoinResult | null): boolean {
  if (classJoin === null) {
    return true;
  }

  return classJoin.status !== "joined" && classJoin.status !== "already_member";
}

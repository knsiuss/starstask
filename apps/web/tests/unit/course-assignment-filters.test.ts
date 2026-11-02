import { describe, expect, it } from "vitest";

import {
  COURSE_ASSIGNMENT_FILTERS,
  groupCourseAssignments,
  resolveCourseAssignmentFilter,
} from "@/features/classes/course-assignment-filters";

const NOW = new Date("2026-11-02T09:00:00.000Z").getTime();

function at(iso: string): string {
  return new Date(iso).toISOString();
}

const soon = { id: "soon", deadline: at("2026-11-05T09:00:00.000Z") };
const later = { id: "later", deadline: at("2026-11-20T09:00:00.000Z") };
const past = { id: "past", deadline: at("2026-10-20T09:00:00.000Z") };
const longerPast = {
  id: "longer-past",
  deadline: at("2026-09-20T09:00:00.000Z"),
};
const openEnded = { id: "open-ended", deadline: null };
const completedOpenEnded = {
  id: "completed-open-ended",
  deadline: null,
};

describe("resolveCourseAssignmentFilter", () => {
  it("accepts every declared filter", () => {
    for (const filter of COURSE_ASSIGNMENT_FILTERS) {
      expect(resolveCourseAssignmentFilter(filter)).toBe(filter);
    }
  });

  it("falls back to all for missing or unknown values", () => {
    expect(resolveCourseAssignmentFilter(undefined)).toBe("all");
    expect(resolveCourseAssignmentFilter("")).toBe("all");
    expect(resolveCourseAssignmentFilter("archived")).toBe("all");
  });
});

describe("groupCourseAssignments", () => {
  const completedIds = new Set([completedOpenEnded.id]);
  const assignments = [
    past,
    later,
    openEnded,
    soon,
    completedOpenEnded,
    longerPast,
  ];

  it("orders upcoming work soonest first", () => {
    const { upcoming } = groupCourseAssignments(assignments, completedIds, NOW);

    expect(upcoming.map((assignment) => assignment.id)).toEqual([
      soon.id,
      later.id,
    ]);
  });

  it("orders closed work with the most recent deadline first", () => {
    const { closed } = groupCourseAssignments(assignments, completedIds, NOW);

    expect(closed.map((assignment) => assignment.id)).toEqual([
      past.id,
      longerPast.id,
    ]);
  });

  it("treats undated, unfinished work as in progress", () => {
    const { inProgress } = groupCourseAssignments(
      assignments,
      completedIds,
      NOW,
    );

    expect(inProgress.map((assignment) => assignment.id)).toEqual([
      openEnded.id,
    ]);
  });

  it("keeps every assignment in exactly one non-submitted group", () => {
    const { upcoming, inProgress, closed } = groupCourseAssignments(
      assignments,
      completedIds,
      NOW,
    );

    expect([...upcoming, ...inProgress, ...closed]).toHaveLength(
      assignments.length - completedIds.size,
    );
  });

  it("does not mutate the source list", () => {
    const source = [later, soon];
    groupCourseAssignments(source, new Set(), NOW);

    expect(source.map((assignment) => assignment.id)).toEqual([
      later.id,
      soon.id,
    ]);
  });

  it("handles an empty course", () => {
    expect(groupCourseAssignments([], new Set(), NOW)).toEqual({
      upcoming: [],
      inProgress: [],
      closed: [],
    });
  });
});

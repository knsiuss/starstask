import { describe, expect, it } from "vitest";

import {
  COURSE_ASSIGNMENT_FILTERS,
  COURSE_ASSIGNMENT_SORTS,
  filterCourseAssignmentsByQuery,
  groupCourseAssignments,
  groupUpcomingAssignments,
  resolveCourseAssignmentFilter,
  resolveCourseAssignmentSort,
  sortCourseAssignments,
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

describe("groupUpcomingAssignments", () => {
  const now = new Date("2026-11-02T09:00:00.000Z");
  const dueToday = {
    id: "due-today",
    deadline: at("2026-11-02T15:00:00.000Z"),
  };
  const dueInThree = {
    id: "due-in-three",
    deadline: at("2026-11-05T09:00:00.000Z"),
  };
  const dueInFour = {
    id: "due-in-four",
    deadline: at("2026-11-06T09:00:00.000Z"),
  };
  const completedSoon = {
    id: "completed-soon",
    deadline: at("2026-11-03T09:00:00.000Z"),
  };
  const undated = { id: "undated", deadline: null };

  it("splits due soon (<= 3 Jakarta days) from later, soonest first", () => {
    const { dueSoon, later } = groupUpcomingAssignments(
      [dueInFour, dueInThree, dueToday, undated],
      new Set(),
      now,
    );

    expect(dueSoon.map((item) => item.id)).toEqual([
      dueToday.id,
      dueInThree.id,
    ]);
    expect(later.map((item) => item.id)).toEqual([dueInFour.id]);
  });

  it("excludes overdue, completed, and undated work", () => {
    const { dueSoon, later } = groupUpcomingAssignments(
      [past, completedSoon, undated, dueInThree],
      new Set([completedSoon.id]),
      now,
    );

    expect(dueSoon.map((item) => item.id)).toEqual([dueInThree.id]);
    expect(later).toEqual([]);
  });
});

describe("filterCourseAssignmentsByQuery", () => {
  const items = [
    { id: "a", title: "Web Programming 1", description: "Tugas Individu" },
    {
      id: "b",
      title: "Tugas Project",
      description: "Kelompok",
      source_label: "Project",
    },
    { id: "c", title: "Ujian Akhir", description: "" },
  ];

  it("matches title, description, and source case-insensitively", () => {
    expect(
      filterCourseAssignmentsByQuery(items, "web").map((i) => i.id),
    ).toEqual(["a"]);
    expect(
      filterCourseAssignmentsByQuery(items, "INDIVIDU").map((i) => i.id),
    ).toEqual(["a"]);
    expect(
      filterCourseAssignmentsByQuery(items, "project").map((i) => i.id),
    ).toEqual(["b"]);
  });

  it("returns everything for a blank query and nothing for a miss", () => {
    expect(filterCourseAssignmentsByQuery(items, "  ")).toHaveLength(3);
    expect(filterCourseAssignmentsByQuery(items, "zzz")).toEqual([]);
  });
});

describe("sortCourseAssignments", () => {
  const items = [
    {
      id: "undated",
      title: "Zulu",
      deadline: null,
      published_at: null,
      created_at: "2026-11-01T00:00:00.000Z",
    },
    {
      id: "late",
      title: "Alpha",
      deadline: at("2026-12-07T00:00:00.000Z"),
      published_at: "2026-11-03T00:00:00.000Z",
      created_at: "2026-11-03T00:00:00.000Z",
    },
    {
      id: "soon",
      title: "Beta",
      deadline: at("2026-11-09T00:00:00.000Z"),
      published_at: "2026-11-02T00:00:00.000Z",
      created_at: "2026-11-02T00:00:00.000Z",
    },
  ];

  it("accepts every declared sort and falls back to due-soonest", () => {
    for (const sort of COURSE_ASSIGNMENT_SORTS) {
      expect(resolveCourseAssignmentSort(sort)).toBe(sort);
    }
    expect(resolveCourseAssignmentSort(undefined)).toBe("due-soonest");
    expect(resolveCourseAssignmentSort("bogus")).toBe("due-soonest");
  });

  it("orders due-soonest with undated work last", () => {
    expect(
      sortCourseAssignments(items, "due-soonest").map((i) => i.id),
    ).toEqual(["soon", "late", "undated"]);
  });

  it("orders due-latest with undated work last", () => {
    expect(sortCourseAssignments(items, "due-latest").map((i) => i.id)).toEqual(
      ["late", "soon", "undated"],
    );
  });

  it("orders by recent publication and by title", () => {
    expect(sortCourseAssignments(items, "recent").map((i) => i.id)).toEqual([
      "late",
      "soon",
      "undated",
    ]);
    expect(sortCourseAssignments(items, "title").map((i) => i.id)).toEqual([
      "late",
      "soon",
      "undated",
    ]);
  });

  it("does not mutate the source list", () => {
    const first = items[0];
    const second = items[1];

    if (!first || !second) {
      throw new Error("Expected two assignments");
    }

    const source = [first, second];
    sortCourseAssignments(source, "due-soonest");
    expect(source[0]?.id).toBe("undated");
  });
});

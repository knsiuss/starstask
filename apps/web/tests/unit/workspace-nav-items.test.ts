import { describe, expect, it } from "vitest";

import {
  LEADER_ITEMS,
  LEARNING_ITEMS,
  STUDY_ITEMS,
  TEACHING_ITEMS,
} from "@/components/layout/workspace-nav-items";

const hrefs = (items: { href: string }[]) => items.map((item) => item.href);

describe("workspace navigation for a lecturer", () => {
  it("leads with teaching destinations and excludes student-only routes", () => {
    expect(hrefs(TEACHING_ITEMS)).toEqual([
      "/lecturer",
      "/actions",
      "/classes",
      "/schedule",
      "/attendance",
      "/leave-requests",
    ]);
    expect(hrefs(TEACHING_ITEMS)).not.toContain("/app");
    expect(hrefs(TEACHING_ITEMS)).not.toContain("/assignments");
    expect(hrefs(TEACHING_ITEMS)).not.toContain("/messages");
  });

  it("keeps the teaching destinations out of the study list", () => {
    const teachingHrefs = new Set(hrefs(TEACHING_ITEMS));
    const duplicates = hrefs(LEARNING_ITEMS).filter((href) =>
      teachingHrefs.has(href),
    );

    expect(duplicates).toEqual([]);
  });

  it("leaves only non-teaching student items in LEARNING_ITEMS", () => {
    expect(hrefs(LEARNING_ITEMS)).toEqual(["/assignments", "/messages"]);
  });

  it("does not change the student study list", () => {
    expect(hrefs(STUDY_ITEMS)).toContain("/app");
    expect(hrefs(STUDY_ITEMS)).toContain("/attendance");
    expect(hrefs(STUDY_ITEMS)).toContain("/leave-requests");
  });

  it("routes the class-leader action center to the same destination", () => {
    expect(hrefs(LEADER_ITEMS)).toEqual(["/actions"]);
  });
});

import { describe, expect, it } from "vitest";

import {
  LEADER_ITEMS,
  LEARNING_ITEMS,
  STUDY_ITEMS,
  TEACHING_ITEMS,
} from "@/components/layout/workspace-nav-items";

const hrefs = (items: { href: string }[]) => items.map((item) => item.href);

describe("workspace navigation for a lecturer", () => {
  it("leads with the work waiting on them", () => {
    expect(hrefs(TEACHING_ITEMS)).toEqual([
      "/app",
      "/app/actions",
      "/attendance",
      "/leave-requests",
    ]);
  });

  it("keeps the teaching destinations out of the study list", () => {
    const teachingHrefs = new Set(hrefs(TEACHING_ITEMS));
    const duplicates = hrefs(LEARNING_ITEMS).filter((href) =>
      teachingHrefs.has(href),
    );

    expect(duplicates).toEqual([]);
  });

  it("still leaves the student-only destinations under My studies", () => {
    expect(hrefs(LEARNING_ITEMS)).toEqual([
      "/assignments",
      "/classes",
      "/schedule",
      "/messages",
    ]);
  });

  it("does not change the student study list", () => {
    expect(hrefs(STUDY_ITEMS)).toContain("/app");
    expect(hrefs(STUDY_ITEMS)).toContain("/attendance");
    expect(hrefs(STUDY_ITEMS)).toContain("/leave-requests");
  });

  it("routes the class-leader action center to the same destination", () => {
    expect(hrefs(LEADER_ITEMS)).toEqual(["/app/actions"]);
  });
});

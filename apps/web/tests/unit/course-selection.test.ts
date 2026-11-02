import { describe, expect, it } from "vitest";

import type { ClassSubjectWithTaskCount } from "@starstask/contracts";

import { resolveCourseSelection } from "@/lib/classes/course-selection";

const CLASS_ID = "2b1d3a4c-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

function course(
  id: string,
  name: string,
  status: ClassSubjectWithTaskCount["status"] = "active",
): ClassSubjectWithTaskCount {
  return {
    id,
    class_id: CLASS_ID,
    course_id: null,
    name,
    code: null,
    description: null,
    lecturer_name: null,
    status,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    task_count: 0,
  };
}

const web = course("11111111-1111-4111-8111-111111111111", "Pemrograman Web");
const data = course("22222222-2222-4222-8222-222222222222", "Basis Data");
const ai = course("33333333-3333-4333-8333-333333333333", "Kecerdasan Buatan");
const archived = course(
  "44444444-4444-4444-8444-444444444444",
  "Jaringan Komputer",
  "archived",
);

describe("resolveCourseSelection", () => {
  it("offers only active courses", () => {
    const { options } = resolveCourseSelection([web, archived, data]);

    expect(options.map((option) => option.id)).toEqual([web.id, data.id]);
  });

  it("preselects the only active course but still returns its id", () => {
    const { options, selectedId } = resolveCourseSelection([web, archived]);

    expect(options).toHaveLength(1);
    expect(selectedId).toBe(web.id);
  });

  it("leaves the choice empty when several courses are available", () => {
    const { options, selectedId } = resolveCourseSelection([web, data, ai]);

    expect(options).toHaveLength(3);
    expect(selectedId).toBe("");
  });

  it("honours a requested course of this class", () => {
    const { selectedId } = resolveCourseSelection([web, data, ai], data.id);

    expect(selectedId).toBe(data.id);
  });

  it("ignores an archived or foreign requested course", () => {
    expect(
      resolveCourseSelection([web, archived], archived.id).selectedId,
    ).toBe(web.id);
    expect(resolveCourseSelection([web, data], ai.id).selectedId).toBe("");
  });

  it("leaves the choice empty when no course exists", () => {
    expect(resolveCourseSelection([archived])).toEqual({
      options: [],
      selectedId: "",
    });
  });
});

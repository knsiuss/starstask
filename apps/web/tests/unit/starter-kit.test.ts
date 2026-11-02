import { describe, expect, it } from "vitest";

import { ASSIGNMENT_TYPES } from "@starstask/contracts";

import {
  STARTER_PRESETS,
  applyStarterAssignment,
  applyStarterPreset,
  type StarterFormValues,
  type StarterPreset,
} from "@/lib/assignments/starter-kit";

function firstPreset(): StarterPreset {
  const [preset] = STARTER_PRESETS;

  if (!preset) {
    throw new Error("No starter presets are defined.");
  }

  return preset;
}

const PRESET = firstPreset();

const EMPTY_VALUES: StarterFormValues = {
  title: "",
  description: "",
  courseName: "",
  courseCode: "",
  department: "",
  lecturerName: "",
  semester: "",
  academicYear: "",
  assignmentType: "",
  deadlineLocal: "",
  tagsText: "",
  referenceUrlsText: "",
};

const FILLED_VALUES: StarterFormValues = {
  ...EMPTY_VALUES,
  title: "My own title",
  courseName: "Database Systems",
  semester: "2",
  academicYear: "2026/2027",
  deadlineLocal: "2026-12-01T23:59",
};

describe("STARTER_PRESETS", () => {
  it("uses a known assignment type for every preset", () => {
    for (const preset of STARTER_PRESETS) {
      expect(ASSIGNMENT_TYPES).toContain(preset.assignmentType);
    }
  });

  it("gives every preset a description that passes the short-message minimum", () => {
    for (const preset of STARTER_PRESETS) {
      expect(preset.description.trim().length).toBeGreaterThanOrEqual(10);
    }
  });

  it("keeps every preset label and id unique", () => {
    expect(new Set(STARTER_PRESETS.map((preset) => preset.id)).size).toBe(
      STARTER_PRESETS.length,
    );
    expect(new Set(STARTER_PRESETS.map((preset) => preset.label)).size).toBe(
      STARTER_PRESETS.length,
    );
  });
});

describe("applyStarterPreset", () => {
  it("fills the description, type, and tags", () => {
    const preset = PRESET;
    const next = applyStarterPreset(EMPTY_VALUES, preset);

    expect(next.description).toBe(preset.description);
    expect(next.assignmentType).toBe(preset.assignmentType);
    expect(next.tagsText).toBe(preset.tags.join(", "));
    expect(next.title).toBe(preset.titleExample);
  });

  it("keeps a title the author already typed", () => {
    const next = applyStarterPreset(FILLED_VALUES, PRESET);

    expect(next.title).toBe("My own title");
  });

  it("leaves course, semester, and deadline fields untouched", () => {
    const next = applyStarterPreset(FILLED_VALUES, PRESET);

    expect(next.courseName).toBe(FILLED_VALUES.courseName);
    expect(next.semester).toBe(FILLED_VALUES.semester);
    expect(next.academicYear).toBe(FILLED_VALUES.academicYear);
    expect(next.deadlineLocal).toBe(FILLED_VALUES.deadlineLocal);
  });
});

describe("applyStarterAssignment", () => {
  const source = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Last semester's brief",
    description:
      "Reuse the same course details and the brief as a starting point.",
    courseName: "Operating Systems",
    courseCode: "IF2230",
    department: "Informatics",
    lecturerName: "Dr. Example",
    assignmentType: "individual",
    tags: ["midterm", "os"],
    referenceUrls: ["https://example.test/reference"],
  };

  it("copies the course details, brief, tags, and references", () => {
    const next = applyStarterAssignment(FILLED_VALUES, source);

    expect(next.courseName).toBe("Operating Systems");
    expect(next.courseCode).toBe("IF2230");
    expect(next.department).toBe("Informatics");
    expect(next.lecturerName).toBe("Dr. Example");
    expect(next.description).toBe(source.description);
    expect(next.assignmentType).toBe("individual");
    expect(next.tagsText).toBe("midterm, os");
    expect(next.referenceUrlsText).toBe("https://example.test/reference");
  });

  it("leaves the new title, deadline, semester, and academic year alone", () => {
    const next = applyStarterAssignment(FILLED_VALUES, source);

    expect(next.title).toBe("My own title");
    expect(next.deadlineLocal).toBe(FILLED_VALUES.deadlineLocal);
    expect(next.semester).toBe(FILLED_VALUES.semester);
    expect(next.academicYear).toBe(FILLED_VALUES.academicYear);
  });

  it("turns missing optional fields into empty strings", () => {
    const next = applyStarterAssignment(EMPTY_VALUES, {
      ...source,
      courseCode: null,
      department: null,
      lecturerName: null,
      assignmentType: null,
      tags: [],
      referenceUrls: [],
    });

    expect(next.courseCode).toBe("");
    expect(next.department).toBe("");
    expect(next.lecturerName).toBe("");
    expect(next.assignmentType).toBe("");
    expect(next.tagsText).toBe("");
    expect(next.referenceUrlsText).toBe("");
  });
});

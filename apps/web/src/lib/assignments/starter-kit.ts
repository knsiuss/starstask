/**
 * Starter kit for a new assignment.
 *
 * A preset fills the description skeleton, the assignment type, and tags. A
 * previous assignment can prefill the course and brief as well. Neither copy
 * path carries the old title, deadline, semester, or academic year: those
 * describe the previous task, not the one being published now.
 */
export type StarterFormValues = {
  title: string;
  description: string;
  courseName: string;
  courseCode: string;
  department: string;
  lecturerName: string;
  semester: string;
  academicYear: string;
  assignmentType: string;
  deadlineLocal: string;
  tagsText: string;
  referenceUrlsText: string;
};

export type StarterPreset = {
  id: string;
  label: string;
  titleExample: string;
  description: string;
  assignmentType: string;
  tags: string[];
};

export type StarterAssignmentSource = {
  id: string;
  title: string;
  description: string;
  courseName: string;
  courseCode: string | null;
  department: string | null;
  lecturerName: string | null;
  assignmentType: string | null;
  tags: string[];
  referenceUrls: string[];
};

export const STARTER_PRESETS: StarterPreset[] = [
  {
    id: "weekly-response",
    label: "Weekly response",
    titleExample: "Weekly response — Week 1",
    description: [
      "What to submit",
      "- ",
      "",
      "Requirements",
      "- ",
      "",
      "Grading",
      "- ",
    ].join("\n"),
    assignmentType: "individual",
    tags: ["weekly"],
  },
  {
    id: "lab-report",
    label: "Lab report",
    titleExample: "Lab report — Experiment 1",
    description: [
      "Objective",
      "- ",
      "",
      "Tools and materials",
      "- ",
      "",
      "Procedure",
      "1. ",
      "",
      "Results and discussion",
      "- ",
      "",
      "Conclusion",
      "- ",
    ].join("\n"),
    assignmentType: "lab",
    tags: ["lab"],
  },
  {
    id: "group-project",
    label: "Group project",
    titleExample: "Group project — Milestone 1",
    description: [
      "Deliverable",
      "- ",
      "",
      "Team size and roles",
      "- ",
      "",
      "Milestones",
      "1. ",
      "",
      "Submission format",
      "- ",
    ].join("\n"),
    assignmentType: "group",
    tags: ["group"],
  },
  {
    id: "presentation",
    label: "Presentation",
    titleExample: "Presentation — Topic",
    description: [
      "Topic",
      "- ",
      "",
      "Duration and format",
      "- ",
      "",
      "Slides and supporting files",
      "- ",
      "",
      "Assessment criteria",
      "- ",
    ].join("\n"),
    assignmentType: "presentation",
    tags: ["presentation"],
  },
];

export function applyStarterPreset(
  values: StarterFormValues,
  preset: StarterPreset,
): StarterFormValues {
  return {
    ...values,
    title: values.title.trim() ? values.title : preset.titleExample,
    description: preset.description,
    assignmentType: preset.assignmentType,
    tagsText: preset.tags.join(", "),
  };
}

export function applyStarterAssignment(
  values: StarterFormValues,
  source: StarterAssignmentSource,
): StarterFormValues {
  return {
    ...values,
    description: source.description,
    courseName: source.courseName,
    courseCode: source.courseCode ?? "",
    department: source.department ?? "",
    lecturerName: source.lecturerName ?? "",
    assignmentType: source.assignmentType ?? "",
    tagsText: source.tags.join(", "),
    referenceUrlsText: source.referenceUrls.join("\n"),
  };
}

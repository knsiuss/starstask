import "server-only";

import type { AssignmentCreateInput } from "@starstask/contracts";

/**
 * Normalizes a multipart submission into the shape expected by
 * `assignmentCreateSchema`. Empty optional fields become `undefined`; arrays are
 * accepted as JSON (preferred) or newline/comma separated text.
 */
export function parseAssignmentForm(form: FormData): Record<string, unknown> {
  return {
    title: stringField(form, "title"),
    description: stringField(form, "description"),
    courseName: stringField(form, "courseName"),
    courseCode: stringField(form, "courseCode"),
    department: stringField(form, "department"),
    lecturerName: stringField(form, "lecturerName"),
    semester: stringField(form, "semester"),
    academicYear: stringField(form, "academicYear"),
    assignmentType: optionalEnum(form, "assignmentType"),
    deadline: stringField(form, "deadline"),
    tags: stringArrayField(form, "tags"),
    referenceUrls: stringArrayField(form, "referenceUrls"),
  };
}

/**
 * Class submissions use a subset of the assignment form: the class supplies
 * course, semester, and lecturer, and the server sets the review status.
 */
export function parseClassSubmissionForm(
  form: FormData,
): Record<string, unknown> {
  return {
    title: stringField(form, "title"),
    description: stringField(form, "description"),
    assignmentType: optionalEnum(form, "assignmentType"),
    deadline: stringField(form, "deadline"),
    tags: stringArrayField(form, "tags"),
    referenceUrls: stringArrayField(form, "referenceUrls"),
  };
}

export function collectFiles(form: FormData): File[] {
  return form
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

export function isHoneypotTripped(form: FormData): boolean {
  const value = form.get("website");

  return typeof value === "string" && value.trim().length > 0;
}

export type AssignmentFormPayload = AssignmentCreateInput;

function stringField(form: FormData, key: string): string | undefined {
  const value = form.get(key);

  return typeof value === "string" ? value : undefined;
}

function optionalEnum(form: FormData, key: string): string | undefined {
  const value = stringField(form, key)?.trim();

  return value ? value : undefined;
}

function stringArrayField(form: FormData, key: string): string[] {
  const value = form.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter(
        (entry): entry is string => typeof entry === "string",
      );
    }
  } catch {
    // Fall back to delimiter parsing for progressive-enhancement clients.
  }

  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

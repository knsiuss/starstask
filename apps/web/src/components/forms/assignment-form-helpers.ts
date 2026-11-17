import {
  ASSIGNMENT_ATTACHMENT_MAX_BYTES,
  ASSIGNMENT_ATTACHMENTS_MAX,
  ATTACHMENT_ALLOWED_EXTENSIONS,
} from "@starstask/contracts";

export type AssignmentFormValues = {
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

export type CourseOption = {
  id: string;
  name: string;
  code: string | null;
  department: string | null;
};

/** Marks a stored course that no longer belongs to any of the user's classes. */
export const CURRENT_COURSE_ID = "current-course";

export const FIELD_IDS: Record<string, string> = {
  title: "title",
  description: "description",
  courseName: "courseName",
  deadline: "deadline",
  tags: "tags",
  referenceUrls: "referenceUrls",
  attachments: "files",
};

/** Create-mode copy, chosen by whether the submission queues for review. */
export const QUEUED_COPY = {
  submitLabel: "Submit for review",
  footnote:
    "A platform admin reviews new submissions before they appear publicly. If a request is rejected, edit it and save again to resubmit.",
};

export const DIRECT_COPY = {
  submitLabel: "Publish assignment",
  footnote:
    "Your submission appears in the public archive as soon as you save it, so check every field first.",
};

export function splitList(value: string, separator: RegExp): string[] {
  return value
    .split(separator)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function focusFirstError(errors: Record<string, string>): void {
  const firstKey = Object.keys(errors)[0];

  if (!firstKey) {
    return;
  }

  const elementId = FIELD_IDS[firstKey];

  if (elementId) {
    document.getElementById(elementId)?.focus();
  }
}

export function buildCreateFormData(
  data: {
    title: string;
    description: string;
    courseName: string;
    courseCode?: string;
    department?: string;
    lecturerName?: string;
    semester?: string;
    academicYear?: string;
    assignmentType?: string;
    deadline?: string;
    tags: string[];
    referenceUrls: string[];
  },
  files: File[],
): FormData {
  const formData = new FormData();

  formData.set("title", data.title);
  formData.set("description", data.description);
  formData.set("courseName", data.courseName);
  formData.set("courseCode", data.courseCode ?? "");
  formData.set("department", data.department ?? "");
  formData.set("lecturerName", data.lecturerName ?? "");
  formData.set("semester", data.semester ?? "");
  formData.set("academicYear", data.academicYear ?? "");
  formData.set("assignmentType", data.assignmentType ?? "");
  formData.set("deadline", data.deadline ?? "");
  formData.set("tags", JSON.stringify(data.tags));
  formData.set("referenceUrls", JSON.stringify(data.referenceUrls));
  formData.set("website", "");

  for (const file of files) {
    formData.append("files", file);
  }

  return formData;
}

export function buildUpdatePayload(
  data: {
    title: string;
    description: string;
    courseName: string;
    tags: string[];
    referenceUrls: string[];
  },
  values: AssignmentFormValues,
  deadlineIso: string | null,
) {
  return {
    title: data.title,
    description: data.description,
    courseName: data.courseName,
    courseCode: values.courseCode.trim() || null,
    department: values.department.trim() || null,
    lecturerName: values.lecturerName.trim() || null,
    semester: values.semester.trim() || null,
    academicYear: values.academicYear.trim() || null,
    assignmentType: values.assignmentType || null,
    deadline: deadlineIso,
    tags: data.tags,
    referenceUrls: data.referenceUrls,
  };
}

export function getInitialFormValues(
  initialValues: AssignmentFormValues,
  courseOptions: CourseOption[],
): AssignmentFormValues {
  // A member of exactly one class has exactly one course; preselect it so the
  // code and department are filled from the class instead of left blank.
  if (initialValues.courseName || courseOptions.length !== 1) {
    return initialValues;
  }

  const onlyCourse = courseOptions[0];

  if (!onlyCourse) {
    return initialValues;
  }

  return {
    ...initialValues,
    courseName: onlyCourse.name,
    courseCode: onlyCourse.code ?? "",
    department: onlyCourse.department ?? "",
  };
}

export function validateSelectedFiles(selected: File[]): {
  files: File[];
  error: string;
} {
  let error = "";

  if (selected.length > ASSIGNMENT_ATTACHMENTS_MAX) {
    error = `Attach at most ${ASSIGNMENT_ATTACHMENTS_MAX} files.`;
  }

  for (const file of selected) {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

    if (!ATTACHMENT_ALLOWED_EXTENSIONS.includes(extension as never)) {
      error =
        "Allowed file types: PDF, DOCX, PPTX, XLSX, PNG, JPG, CSV, IPYNB, TXT, PY, JS, ZIP.";
    }

    if (file.size > ASSIGNMENT_ATTACHMENT_MAX_BYTES) {
      error = "Each file must be 10 MB or smaller.";
    }
  }

  return {
    files: selected.slice(0, ASSIGNMENT_ATTACHMENTS_MAX),
    error,
  };
}

export async function submitAssignmentRequest({
  mode,
  assignmentId,
  parsedData,
  values,
  deadlineIso,
  files,
}: {
  mode: "create" | "edit";
  assignmentId?: string;
  parsedData: {
    title: string;
    description: string;
    courseName: string;
    courseCode?: string;
    department?: string;
    lecturerName?: string;
    semester?: string;
    academicYear?: string;
    assignmentType?: string;
    deadline?: string;
    tags: string[];
    referenceUrls: string[];
  };
  values: AssignmentFormValues;
  deadlineIso: string | null;
  files: File[];
}): Promise<
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors: Record<string, string> }
> {
  const response =
    mode === "create"
      ? await fetch("/api/assignments", {
          method: "POST",
          body: buildCreateFormData(parsedData, files),
        })
      : await fetch(`/api/assignments/${assignmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildUpdatePayload(parsedData, values, deadlineIso),
          ),
        });

  const body = (await response.json().catch(() => null)) as {
    data?: { id?: string };
    error?: { message?: string; fieldErrors?: Record<string, string> };
  } | null;

  if (!response.ok) {
    return {
      ok: false,
      fieldErrors: body?.error?.fieldErrors ?? {},
      message: body?.error?.message ?? "Could not save the assignment.",
    };
  }

  const id = body?.data?.id ?? assignmentId;

  if (!id) {
    return {
      ok: false,
      fieldErrors: {},
      message: "The assignment was saved, but its id was missing.",
    };
  }

  return { ok: true, id };
}

/**
 * Keeps an edited assignment's stored course selectable even if the user
 * has since left that class, preventing silent course rewrites on save.
 */
export function buildCourseChoices(
  values: AssignmentFormValues,
  courseOptions: CourseOption[],
): CourseOption[] {
  if (
    !values.courseName ||
    courseOptions.some((course) => course.name === values.courseName)
  ) {
    return courseOptions;
  }

  return [
    ...courseOptions,
    {
      id: CURRENT_COURSE_ID,
      name: values.courseName,
      code: values.courseCode || null,
      department: values.department || null,
    },
  ];
}

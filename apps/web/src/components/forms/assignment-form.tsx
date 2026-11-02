"use client";

import { Loader2, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  ASSIGNMENT_ATTACHMENT_MAX_BYTES,
  ASSIGNMENT_ATTACHMENTS_MAX,
  ASSIGNMENT_TYPES,
  ATTACHMENT_ALLOWED_EXTENSIONS,
  assignmentCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";
import { formatFileSize, fromJakartaDateTimeInput } from "@starstask/shared";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  STARTER_PRESETS,
  applyStarterAssignment,
  applyStarterPreset,
  type StarterAssignmentSource,
  type StarterPreset,
} from "@/lib/assignments/starter-kit";

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

type AssignmentFormProps = {
  mode: "create" | "edit";
  assignmentId?: string;
  initialValues: AssignmentFormValues;
  /** Courses of the classes the user belongs to; empty for a user with none. */
  courseOptions: {
    id: string;
    name: string;
    code: string | null;
    department: string | null;
  }[];
  previousAssignments?: StarterAssignmentSource[];
};

/** Marks a stored course that no longer belongs to any of the user's classes. */
const CURRENT_COURSE_ID = "current-course";

const FIELD_IDS: Record<string, string> = {
  title: "title",
  description: "description",
  courseName: "courseName",
  deadline: "deadline",
  tags: "tags",
  referenceUrls: "referenceUrls",
  attachments: "files",
};

export function AssignmentForm({
  mode,
  assignmentId,
  initialValues,
  courseOptions,
  previousAssignments = [],
}: AssignmentFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState(() => {
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
  });
  const [files, setFiles] = React.useState<File[]>([]);
  const [previousId, setPreviousId] = React.useState("");
  const [starterNote, setStarterNote] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formMessage, setFormMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const update = (key: keyof AssignmentFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  // An edited assignment may point at a course the user has since left. Keep it
  // selectable so saving cannot silently rewrite the course of a submission.
  const courseChoices =
    values.courseName &&
    !courseOptions.some((course) => course.name === values.courseName)
      ? [
          ...courseOptions,
          {
            id: CURRENT_COURSE_ID,
            name: values.courseName,
            code: values.courseCode || null,
            department: values.department || null,
          },
        ]
      : courseOptions;

  const selectedCourse = courseChoices.find(
    (course) => course.name === values.courseName,
  );

  const handleCourseChange = (courseId: string) => {
    const course = courseChoices.find((option) => option.id === courseId);

    if (!course) {
      return;
    }

    setValues((current) => ({
      ...current,
      courseName: course.name,
      courseCode: course.code ?? "",
      department: course.department ?? "",
    }));
  };

  const applyPreset = (preset: StarterPreset) => {
    setValues((current) => applyStarterPreset(current, preset));
    setFieldErrors({});
    setFormMessage(null);
    setStarterNote(
      `${preset.label} template applied. Review every field before publishing.`,
    );
  };

  const applyPreviousAssignment = () => {
    const source = previousAssignments.find((item) => item.id === previousId);

    if (!source) {
      return;
    }

    setValues((current) => applyStarterAssignment(current, source));
    setFieldErrors({});
    setFormMessage(null);
    setStarterNote(
      "Details copied. Your title, deadline, semester, and academic year were left unchanged.",
    );
  };

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    const nextErrors: Record<string, string> = {};

    if (selected.length > ASSIGNMENT_ATTACHMENTS_MAX) {
      nextErrors.attachments = `Attach at most ${ASSIGNMENT_ATTACHMENTS_MAX} files.`;
    }

    for (const file of selected) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

      if (!ATTACHMENT_ALLOWED_EXTENSIONS.includes(extension as never)) {
        nextErrors.attachments =
          "Allowed file types: PDF, DOCX, PPTX, XLSX, PNG, JPG.";
      }

      if (file.size > ASSIGNMENT_ATTACHMENT_MAX_BYTES) {
        nextErrors.attachments = "Each file must be 10 MB or smaller.";
      }
    }

    setFieldErrors((current) => ({
      ...current,
      attachments: nextErrors.attachments ?? "",
    }));
    setFiles(selected.slice(0, ASSIGNMENT_ATTACHMENTS_MAX));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setFieldErrors({});
    setFormMessage(null);

    const deadlineIso = values.deadlineLocal
      ? fromJakartaDateTimeInput(values.deadlineLocal)
      : null;

    if (values.deadlineLocal && !deadlineIso) {
      setFieldErrors({ deadline: "Enter a valid date and time." });
      return;
    }

    const payload = {
      title: values.title,
      description: values.description,
      courseName: values.courseName,
      courseCode: values.courseCode || undefined,
      department: values.department || undefined,
      lecturerName: values.lecturerName || undefined,
      semester: values.semester || undefined,
      academicYear: values.academicYear || undefined,
      assignmentType: values.assignmentType || undefined,
      deadline: deadlineIso ?? undefined,
      tags: splitList(values.tagsText, /,/),
      referenceUrls: splitList(values.referenceUrlsText, /\n/),
    };

    const parsed = assignmentCreateSchema.safeParse(payload);

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      focusFirstError(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response =
        mode === "create"
          ? await fetch("/api/assignments", {
              method: "POST",
              body: buildCreateFormData(parsed.data, files),
            })
          : await fetch(`/api/assignments/${assignmentId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                buildUpdatePayload(parsed.data, values, deadlineIso),
              ),
            });

      const body = (await response.json().catch(() => null)) as {
        data?: { id?: string };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        const errors = body?.error?.fieldErrors ?? {};
        setFieldErrors(errors);
        setFormMessage(
          body?.error?.message ?? "Could not save the assignment.",
        );
        focusFirstError(errors);
        return;
      }

      const id = body?.data?.id ?? assignmentId;

      if (!id) {
        setFormMessage("The assignment was saved, but its id was missing.");
        return;
      }

      router.push(
        mode === "create"
          ? `/assignments/${id}?created=1`
          : `/assignments/${id}?updated=1`,
      );
      router.refresh();
    } catch {
      setFormMessage("Network error. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-8"
    >
      {formMessage ? <Alert variant="error">{formMessage}</Alert> : null}

      {mode === "create" ? (
        <fieldset className="border-border bg-subtle space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-base font-semibold">Starter kit</legend>
          <p className="text-muted-foreground text-sm">
            Optional. A template fills the description skeleton, type, and tags.
            You can still change everything afterwards.
          </p>

          <div className="flex flex-wrap gap-2">
            {STARTER_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {previousAssignments.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="previous-assignment">
                  Copy details from a previous assignment
                </Label>
                <Select
                  id="previous-assignment"
                  value={previousId}
                  onChange={(event) => setPreviousId(event.target.value)}
                >
                  <option value="">Choose one of your assignments</option>
                  {previousAssignments.map((assignment) => (
                    <option
                      key={assignment.id}
                      value={assignment.id}
                    >
                      {assignment.title} · {assignment.courseName}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={!previousId}
                onClick={applyPreviousAssignment}
              >
                Copy details
              </Button>
            </div>
          ) : null}

          {starterNote ? (
            <p
              aria-live="polite"
              className="text-muted-foreground text-xs"
            >
              {starterNote}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <fieldset className="space-y-5">
        <legend className="text-base font-semibold">Assignment details</legend>

        <Field
          id="title"
          label="Title"
          error={fieldErrors.title}
          required
        >
          <Input
            id="title"
            name="title"
            value={values.title}
            onChange={(event) => update("title", event.target.value)}
            maxLength={200}
            required
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={fieldErrors.title ? "title-error" : undefined}
            placeholder="e.g. Normalization exercise — Chapter 4"
          />
        </Field>

        <Field
          id="description"
          label="Description or instructions"
          error={fieldErrors.description}
          required
          hint="Paste the brief, requirements, and any grading notes. Do not include private personal data."
        >
          <Textarea
            id="description"
            name="description"
            value={values.description}
            onChange={(event) => update("description", event.target.value)}
            rows={8}
            maxLength={20_000}
            required
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={
              fieldErrors.description
                ? "description-error description-hint"
                : "description-hint"
            }
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-base font-semibold">Course</legend>

        {courseOptions.length > 0 ? (
          <>
            <Field
              id="courseName"
              label="Course"
              error={fieldErrors.courseName}
              required
            >
              <Select
                id="courseName"
                name="courseName"
                value={selectedCourse?.id ?? ""}
                onChange={(event) => handleCourseChange(event.target.value)}
                required
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.courseName)}
                aria-describedby={
                  fieldErrors.courseName
                    ? "courseName-error courseName-hint"
                    : "courseName-hint"
                }
              >
                <option value="">Select a course</option>
                {courseChoices.map((course) => (
                  <option
                    key={course.id}
                    value={course.id}
                  >
                    {course.code &&
                    course.code.toLowerCase() !== course.name.toLowerCase()
                      ? `${course.name} (${course.code})`
                      : course.name}
                  </option>
                ))}
              </Select>
              <p
                id="courseName-hint"
                className="text-muted-foreground text-xs"
              >
                Courses come from the classes you belong to. The code and
                department follow the class.
              </p>
            </Field>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium">Course code</dt>
                <dd className="text-muted-foreground mt-1 text-sm">
                  {values.courseCode || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium">Department</dt>
                <dd className="text-muted-foreground mt-1 text-sm">
                  {values.department || "—"}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <Field
              id="courseName"
              label="Course name"
              error={fieldErrors.courseName}
              required
            >
              <Input
                id="courseName"
                name="courseName"
                value={values.courseName}
                onChange={(event) => update("courseName", event.target.value)}
                maxLength={120}
                required
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.courseName)}
                aria-describedby={
                  fieldErrors.courseName ? "courseName-error" : undefined
                }
                placeholder="e.g. Database Systems"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="courseCode"
                label="Course code"
                error={fieldErrors.courseCode}
              >
                <Input
                  id="courseCode"
                  name="courseCode"
                  value={values.courseCode}
                  onChange={(event) => update("courseCode", event.target.value)}
                  maxLength={20}
                  placeholder="e.g. IF2230"
                />
              </Field>
              <Field
                id="department"
                label="Department"
                error={fieldErrors.department}
              >
                <Input
                  id="department"
                  name="department"
                  value={values.department}
                  onChange={(event) => update("department", event.target.value)}
                  maxLength={120}
                  placeholder="e.g. Informatics"
                />
              </Field>
            </div>

            <p className="text-muted-foreground text-xs">
              Join a class to pick its course instead of typing one.
            </p>
          </>
        )}
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-base font-semibold">Optional details</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="lecturerName"
            label="Lecturer"
            error={fieldErrors.lecturerName}
          >
            <Input
              id="lecturerName"
              name="lecturerName"
              value={values.lecturerName}
              onChange={(event) => update("lecturerName", event.target.value)}
              maxLength={120}
            />
          </Field>
          <Field
            id="assignmentType"
            label="Type"
            error={fieldErrors.assignmentType}
          >
            <Select
              id="assignmentType"
              name="assignmentType"
              value={values.assignmentType}
              onChange={(event) => update("assignmentType", event.target.value)}
            >
              <option value="">Not specified</option>
              {ASSIGNMENT_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="semester"
            label="Semester"
            error={fieldErrors.semester}
          >
            <Input
              id="semester"
              name="semester"
              value={values.semester}
              onChange={(event) => update("semester", event.target.value)}
              maxLength={20}
              placeholder="e.g. 1"
            />
          </Field>
          <Field
            id="academicYear"
            label="Academic year"
            error={fieldErrors.academicYear}
            hint="Format: 2025/2026"
          >
            <Input
              id="academicYear"
              name="academicYear"
              value={values.academicYear}
              onChange={(event) => update("academicYear", event.target.value)}
              maxLength={20}
              placeholder="2025/2026"
              aria-invalid={Boolean(fieldErrors.academicYear)}
              aria-describedby={
                fieldErrors.academicYear ? "academicYear-error" : undefined
              }
            />
          </Field>
        </div>

        <Field
          id="deadline"
          label="Deadline"
          error={fieldErrors.deadline}
          hint="Optional. Times are interpreted as Asia/Jakarta (WIB)."
        >
          <Input
            id="deadline"
            name="deadline"
            type="datetime-local"
            value={values.deadlineLocal}
            onChange={(event) => update("deadlineLocal", event.target.value)}
            aria-invalid={Boolean(fieldErrors.deadline)}
            aria-describedby={
              fieldErrors.deadline ? "deadline-error" : "deadline-hint"
            }
          />
        </Field>

        <Field
          id="tags"
          label="Tags"
          error={fieldErrors.tags}
          hint="Comma separated, up to 10 tags."
        >
          <Input
            id="tags"
            name="tags"
            value={values.tagsText}
            onChange={(event) => update("tagsText", event.target.value)}
            placeholder="database, sql, chapter-4"
            aria-invalid={Boolean(fieldErrors.tags)}
            aria-describedby={fieldErrors.tags ? "tags-error" : "tags-hint"}
          />
        </Field>

        <Field
          id="referenceUrls"
          label="Reference links"
          error={fieldErrors.referenceUrls}
          hint="One http(s) link per line, up to 10."
        >
          <Textarea
            id="referenceUrls"
            name="referenceUrls"
            value={values.referenceUrlsText}
            onChange={(event) =>
              update("referenceUrlsText", event.target.value)
            }
            rows={3}
            placeholder="https://example.com/reference"
            aria-invalid={Boolean(fieldErrors.referenceUrls)}
            aria-describedby={
              fieldErrors.referenceUrls
                ? "referenceUrls-error"
                : "referenceUrls-hint"
            }
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">Attachments</legend>

        {mode === "create" ? (
          <>
            <p
              id="files-hint"
              className="text-muted-foreground text-sm"
            >
              Optional. Up to {ASSIGNMENT_ATTACHMENTS_MAX} files, 10 MB each.
              PDF, DOCX, PPTX, XLSX, PNG, or JPG.
            </p>
            <div className="border-border bg-subtle rounded-md border border-dashed p-4">
              <Label
                htmlFor="files"
                className="inline-flex items-center gap-2"
              >
                <Paperclip
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Choose files
              </Label>
              <input
                id="files"
                name="files"
                type="file"
                multiple
                accept={ATTACHMENT_ALLOWED_EXTENSIONS.map(
                  (ext) => `.${ext}`,
                ).join(",")}
                onChange={handleFiles}
                className="text-muted-foreground file:bg-accent-soft file:text-accent mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium"
                aria-invalid={Boolean(fieldErrors.attachments)}
                aria-describedby={
                  fieldErrors.attachments
                    ? "files-error files-hint"
                    : "files-hint"
                }
              />
              {files.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {files.map((file) => (
                    <li
                      key={`${file.name}-${file.size}`}
                      className="flex justify-between gap-3"
                    >
                      <span className="truncate">{file.name}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {formatFileSize(file.size)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {fieldErrors.attachments ? (
              <p
                id="files-error"
                className="text-danger text-sm"
              >
                {fieldErrors.attachments}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Attachments cannot be changed after submission. Delete and re-create
            the assignment if you need to replace files.
          </p>
        )}
      </fieldset>

      <div
        className="hidden"
        aria-hidden="true"
      >
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
              Saving...
            </>
          ) : mode === "create" ? (
            "Publish assignment"
          ) : (
            "Save changes"
          )}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span
            aria-hidden="true"
            className="text-danger ml-0.5"
          >
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint ? (
        <p
          id={`${id}-hint`}
          className="text-muted-foreground text-xs"
        >
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          className="text-danger text-xs"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function splitList(value: string, separator: RegExp): string[] {
  return value
    .split(separator)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function focusFirstError(errors: Record<string, string>): void {
  const firstKey = Object.keys(errors)[0];

  if (!firstKey) {
    return;
  }

  const elementId = FIELD_IDS[firstKey];

  if (elementId) {
    document.getElementById(elementId)?.focus();
  }
}

function buildCreateFormData(
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

function buildUpdatePayload(
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

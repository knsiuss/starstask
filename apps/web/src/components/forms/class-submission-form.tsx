"use client";

import { Loader2, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  ASSIGNMENT_ATTACHMENT_MAX_BYTES,
  ASSIGNMENT_ATTACHMENTS_MAX,
  ASSIGNMENT_CONTENT_TYPE_HINTS,
  ASSIGNMENT_CONTENT_TYPE_LABELS,
  ASSIGNMENT_CONTENT_TYPES,
  ASSIGNMENT_TYPES,
  ATTACHMENT_ALLOWED_EXTENSIONS,
  classSubmissionCreateSchema,
  classSubmissionReviseSchema,
  toFieldErrors,
} from "@starstask/contracts";
import {
  formatFileSize,
  fromJakartaDateTimeInput,
  toJakartaDateTimeInput,
} from "@starstask/shared";

import { CourseSelector } from "@/components/classes/course-selector";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CourseOption } from "@/lib/classes/course-selection";

export type ClassSubmissionFormValues = {
  title: string;
  description: string;
  assignmentType: string;
  contentType: string;
  sourceLabel: string;
  driveUrl: string;
  subjectId: string;
  deadlineLocal: string;
  tagsText: string;
  referenceUrlsText: string;
};

type ClassSubmissionFormProps = {
  classSlug: string;
  mode: "create" | "revise";
  assignmentId?: string;
  initialValues: ClassSubmissionFormValues;
  initialDeadline?: string | null;
  /** True when the author manages the class, so their post needs no review. */
  publishImmediately?: boolean;
  /** Active courses of this class. A new post must belong to one of them. */
  courses?: CourseOption[];
  /** The course shown above the form, so its context is never implicit. */
  courseName?: string;
};

const FIELD_IDS: Record<string, string> = {
  title: "title",
  description: "description",
  contentType: "contentType",
  sourceLabel: "sourceLabel",
  driveUrl: "driveUrl",
  subjectId: "subjectId",
  deadline: "deadline",
  tags: "tags",
  referenceUrls: "referenceUrls",
  attachments: "files",
};

export function submissionInitialValues(deadline?: string | null) {
  return {
    title: "",
    description: "",
    assignmentType: "",
    contentType: "lecturer_assignment",
    sourceLabel: "",
    driveUrl: "",
    subjectId: "",
    deadlineLocal: deadline ? toJakartaDateTimeInput(deadline) : "",
    tagsText: "",
    referenceUrlsText: "",
  } satisfies ClassSubmissionFormValues;
}

/** Which banner the class page shows after a save. */
function buildResultSuffix(
  mode: "create" | "revise",
  isPublished: boolean,
): string {
  if (mode === "revise") {
    return "revised=1";
  }

  return isPublished ? "posted=1" : "submitted=1";
}

/**
 * Submits or revises a class assignment.
 *
 * The form never chooses the review status. A class member's submission waits in
 * `pending_review`; a class admin's own post is published by the server once its
 * attachments are attached, because nobody else could review it.
 */
export function ClassSubmissionForm({
  classSlug,
  mode,
  assignmentId,
  initialValues,
  publishImmediately = false,
  courses = [],
  courseName,
}: ClassSubmissionFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState(initialValues);
  const [files, setFiles] = React.useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formMessage, setFormMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const update = (key: keyof ClassSubmissionFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const selectedCourse = courses.find(
    (course) => course.id === values.subjectId,
  );
  const activeCourseName =
    mode === "revise" ? courseName : selectedCourse?.name;
  const canSubmit = mode === "revise" || courses.length > 0;

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    let error: string | null = null;

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

    setFieldErrors((current) => ({
      ...current,
      attachments: error ?? "",
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

    const schema =
      mode === "create"
        ? classSubmissionCreateSchema
        : classSubmissionReviseSchema;
    const parsed = schema.safeParse({
      title: values.title,
      description: values.description,
      assignmentType: values.assignmentType || undefined,
      contentType: values.contentType || undefined,
      sourceLabel: values.sourceLabel,
      driveUrl: values.driveUrl,
      subjectId: values.subjectId || undefined,
      deadline: deadlineIso ?? undefined,
      tags: values.tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      referenceUrls: values.referenceUrlsText
        .split("\n")
        .map((url) => url.trim())
        .filter(Boolean),
    });

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      focusFirstError(errors);
      return;
    }

    const formData = new FormData();

    formData.set("title", parsed.data.title);
    formData.set("description", parsed.data.description);
    formData.set("assignmentType", parsed.data.assignmentType ?? "");
    formData.set("contentType", parsed.data.contentType);
    formData.set("sourceLabel", parsed.data.sourceLabel ?? "");
    formData.set("driveUrl", parsed.data.driveUrl ?? "");
    formData.set("subjectId", parsed.data.subjectId ?? "");
    formData.set("deadline", parsed.data.deadline ?? "");
    formData.set("tags", JSON.stringify(parsed.data.tags));
    formData.set("referenceUrls", JSON.stringify(parsed.data.referenceUrls));

    for (const file of files) {
      formData.append("files", file);
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        mode === "create"
          ? `/api/classes/${classSlug}/submissions`
          : `/api/classes/${classSlug}/submissions/${assignmentId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          body: formData,
        },
      );

      const body = (await response.json().catch(() => null)) as {
        data?: { id?: string; status?: "published" | "pending_review" };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        const errors = body?.error?.fieldErrors ?? {};
        setFieldErrors(errors);
        setFormMessage(
          body?.error?.message ?? "Could not save the submission.",
        );
        focusFirstError(errors);
        return;
      }

      const published = body?.data?.status === "published";
      const suffix = buildResultSuffix(mode, published);
      const courseId = parsed.data.subjectId;

      router.push(
        courseId
          ? `/app/classes/${classSlug}/courses/${courseId}/assignments?${suffix}`
          : `/app/classes/${classSlug}?${suffix}`,
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
      className="space-y-6"
    >
      {activeCourseName ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Course:</span>{" "}
          <span className="font-semibold">{activeCourseName}</span>
        </p>
      ) : null}

      <Alert variant="info">
        {publishImmediately && mode === "create" ? (
          <>
            <p className="font-medium">Your post goes live immediately.</p>
            <p className="mt-1">
              You are a class admin, so nobody reviews your post. Members with
              notifications enabled are alerted as soon as it is published, and
              the title, description, links, and attachments become visible to
              signed-in students. Do not upload private or sensitive documents.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">Every submission is reviewed first.</p>
            <p className="mt-1">
              A class admin must approve this assignment before it appears in
              search. If approved, the title, description, links, and
              attachments become visible to signed-in students. Do not upload
              private or sensitive documents.
            </p>
          </>
        )}
      </Alert>

      {formMessage ? <Alert variant="error">{formMessage}</Alert> : null}

      <fieldset className="space-y-5">
        <legend className="text-base font-semibold">Assignment details</legend>

        {publishImmediately ? (
          <Field
            id="contentType"
            label="What are you posting?"
            error={fieldErrors.contentType}
            hint={
              ASSIGNMENT_CONTENT_TYPE_HINTS[
                values.contentType === "class_announcement"
                  ? "class_announcement"
                  : "lecturer_assignment"
              ]
            }
          >
            <Select
              id="contentType"
              name="contentType"
              value={values.contentType}
              onChange={(event) => update("contentType", event.target.value)}
            >
              {ASSIGNMENT_CONTENT_TYPES.map((contentType) => (
                <option
                  key={contentType}
                  value={contentType}
                >
                  {ASSIGNMENT_CONTENT_TYPE_LABELS[contentType]}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {values.contentType !== "class_announcement" ? (
          <Field
            id="sourceLabel"
            label="Recorded from (optional)"
            error={fieldErrors.sourceLabel}
            hint="The lecturer whose instructions these are. Leave empty if you wrote them yourself — your account is always shown as the recorder."
          >
            <Input
              id="sourceLabel"
              name="sourceLabel"
              value={values.sourceLabel}
              onChange={(event) => update("sourceLabel", event.target.value)}
              maxLength={120}
              aria-invalid={Boolean(fieldErrors.sourceLabel)}
              placeholder="e.g. Dr. Ani Wijaya"
            />
          </Field>
        ) : null}

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
          />
        </Field>

        <Field
          id="description"
          label="Description or instructions"
          error={fieldErrors.description}
          required
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
          />
        </Field>

        {mode === "create" ? (
          <CourseSelector
            id="subjectId"
            courses={courses}
            value={values.subjectId}
            onChange={(courseId) => update("subjectId", courseId)}
            error={fieldErrors.subjectId}
            hint="This post is filed under the chosen course and appears only in that course."
          />
        ) : (
          <Field
            id="subjectId"
            label="Course"
            hint="A revision keeps the course chosen when this post was created."
          >
            <div className="border-border bg-subtle text-foreground rounded-md border px-3 py-2 text-sm font-medium">
              {courseName ?? "Not linked to a course"}
            </div>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
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
            id="deadline"
            label="Deadline"
            error={fieldErrors.deadline}
            hint="Times are interpreted as Asia/Jakarta (WIB)."
          >
            <Input
              id="deadline"
              name="deadline"
              type="datetime-local"
              value={values.deadlineLocal}
              onChange={(event) => update("deadlineLocal", event.target.value)}
              aria-invalid={Boolean(fieldErrors.deadline)}
            />
          </Field>
        </div>

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
          />
        </Field>

        <Field
          id="driveUrl"
          label="Google Drive link (optional)"
          error={fieldErrors.driveUrl}
          hint="A shared Drive or Docs link. It opens in a new tab; students still need access permission from you."
        >
          <Input
            id="driveUrl"
            name="driveUrl"
            type="url"
            value={values.driveUrl}
            onChange={(event) => update("driveUrl", event.target.value)}
            maxLength={2048}
            placeholder="https://drive.google.com/..."
            aria-invalid={Boolean(fieldErrors.driveUrl)}
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
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">
          Attachments {mode === "revise" ? "(optional, adds new files)" : ""}
        </legend>
        <p
          id="files-hint"
          className="text-muted-foreground text-sm"
        >
          Up to {ASSIGNMENT_ATTACHMENTS_MAX} files, 10 MB each. PDF, DOCX, PPTX,
          XLSX, PNG, or JPG.
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
            accept={ATTACHMENT_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(
              ",",
            )}
            onChange={handleFiles}
            className="text-muted-foreground file:bg-accent-soft file:text-accent mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium"
            aria-invalid={Boolean(fieldErrors.attachments)}
            aria-describedby="files-hint"
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
          <p className="text-danger text-sm">{fieldErrors.attachments}</p>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={isSubmitting || !canSubmit}
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
            "Submit for review"
          ) : (
            "Resubmit for review"
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

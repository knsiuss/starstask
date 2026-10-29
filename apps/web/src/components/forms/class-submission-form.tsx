"use client";

import { Loader2, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  ASSIGNMENT_ATTACHMENT_MAX_BYTES,
  ASSIGNMENT_ATTACHMENTS_MAX,
  ASSIGNMENT_TYPES,
  ATTACHMENT_ALLOWED_EXTENSIONS,
  classSubmissionCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";
import {
  formatFileSize,
  fromJakartaDateTimeInput,
  toJakartaDateTimeInput,
} from "@starstask/shared";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ClassSubmissionFormValues = {
  title: string;
  description: string;
  assignmentType: string;
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
};

const FIELD_IDS: Record<string, string> = {
  title: "title",
  description: "description",
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
    deadlineLocal: deadline ? toJakartaDateTimeInput(deadline) : "",
    tagsText: "",
    referenceUrlsText: "",
  } satisfies ClassSubmissionFormValues;
}

/**
 * Submits or revises a class assignment.
 *
 * The form never chooses the review status: the server function puts every
 * submission in `pending_review`. Attachments are uploaded with the request and
 * become public only if a class admin approves the submission.
 */
export function ClassSubmissionForm({
  classSlug,
  mode,
  assignmentId,
  initialValues,
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

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    let error: string | null = null;

    if (selected.length > ASSIGNMENT_ATTACHMENTS_MAX) {
      error = `Attach at most ${ASSIGNMENT_ATTACHMENTS_MAX} files.`;
    }

    for (const file of selected) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

      if (!ATTACHMENT_ALLOWED_EXTENSIONS.includes(extension as never)) {
        error = "Allowed file types: PDF, DOCX, PPTX, XLSX, PNG, JPG.";
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

    const parsed = classSubmissionCreateSchema.safeParse({
      title: values.title,
      description: values.description,
      assignmentType: values.assignmentType || undefined,
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
        data?: { id?: string };
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

      const suffix = mode === "create" ? "submitted=1" : "revised=1";
      router.push(`/dashboard/classes/${classSlug}?${suffix}`);
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
      <Alert variant="info">
        <p className="font-medium">Every submission is reviewed first.</p>
        <p className="mt-1">
          A class admin must approve this assignment before it appears in public
          search. If approved, the title, description, links, and attachments
          become visible without login. Do not upload private or sensitive
          documents.
        </p>
      </Alert>

      {formMessage ? <Alert variant="error">{formMessage}</Alert> : null}

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

"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  classApplicationCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ClassApplicationFormValues = {
  proposedName: string;
  proposedSlug: string;
  courseName: string;
  institution: string;
  lecturerName: string;
  semester: string;
  academicYear: string;
  description: string;
  reason: string;
  supportingInfo: string;
};

type ClassApplicationFormProps = {
  mode: "create" | "revise";
  applicationId?: string;
  initialValues: ClassApplicationFormValues;
};

const FIELD_IDS: Record<string, string> = {
  proposedName: "proposedName",
  proposedSlug: "proposedSlug",
  courseName: "courseName",
  semester: "semester",
  academicYear: "academicYear",
  description: "description",
  reason: "reason",
};

/**
 * Submits a class creation application.
 *
 * An approval by a platform admin is required before the class exists; this
 * form never creates a class directly. Correcting a rejected application puts
 * it back in the review queue through the revise endpoint.
 */
export function ClassApplicationForm({
  mode,
  applicationId,
  initialValues,
}: ClassApplicationFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState(initialValues);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formMessage, setFormMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const update = (key: keyof ClassApplicationFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleNameBlur = () => {
    if (values.proposedSlug.trim().length > 0) {
      return;
    }

    const suggested = slugify(values.proposedName);

    if (suggested) {
      update("proposedSlug", suggested);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setFieldErrors({});
    setFormMessage(null);

    const payload = {
      proposedName: values.proposedName,
      proposedSlug: values.proposedSlug,
      courseName: values.courseName,
      institution: values.institution || undefined,
      lecturerName: values.lecturerName || undefined,
      semester: values.semester,
      academicYear: values.academicYear,
      description: values.description,
      reason: values.reason,
      supportingInfo: values.supportingInfo || undefined,
    };

    const parsed = classApplicationCreateSchema.safeParse(payload);

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      focusFirstError(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/classes/applications"
          : `/api/classes/applications/${applicationId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
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
          body?.error?.message ?? "Could not save the application.",
        );
        focusFirstError(errors);
        return;
      }

      const id = body?.data?.id ?? applicationId;

      router.push(id ? `/dashboard/applications/${id}?saved=1` : "/dashboard");
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
      {formMessage ? <Alert variant="error">{formMessage}</Alert> : null}

      <fieldset className="space-y-5">
        <legend className="text-base font-semibold">Proposed class</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="proposedName"
            label="Class name"
            error={fieldErrors.proposedName}
            required
          >
            <Input
              id="proposedName"
              name="proposedName"
              value={values.proposedName}
              onChange={(event) => update("proposedName", event.target.value)}
              onBlur={handleNameBlur}
              maxLength={120}
              required
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.proposedName)}
              placeholder="e.g. Database Systems — Class B"
            />
          </Field>

          <Field
            id="proposedSlug"
            label="Class link (slug)"
            error={fieldErrors.proposedSlug}
            hint="Lowercase letters, numbers, and single hyphens."
            required
          >
            <Input
              id="proposedSlug"
              name="proposedSlug"
              value={values.proposedSlug}
              onChange={(event) => update("proposedSlug", event.target.value)}
              maxLength={80}
              required
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.proposedSlug)}
              placeholder="database-systems-b"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="courseName"
            label="Course or subject"
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
            />
          </Field>

          <Field
            id="semester"
            label="Semester"
            error={fieldErrors.semester}
            required
          >
            <Input
              id="semester"
              name="semester"
              value={values.semester}
              onChange={(event) => update("semester", event.target.value)}
              maxLength={20}
              required
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.semester)}
              placeholder="e.g. 1"
            />
          </Field>

          <Field
            id="academicYear"
            label="Academic year"
            error={fieldErrors.academicYear}
            hint="Format: 2025/2026"
            required
          >
            <Input
              id="academicYear"
              name="academicYear"
              value={values.academicYear}
              onChange={(event) => update("academicYear", event.target.value)}
              maxLength={20}
              required
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.academicYear)}
              placeholder="2025/2026"
            />
          </Field>

          <Field
            id="institution"
            label="Institution"
            error={fieldErrors.institution}
          >
            <Input
              id="institution"
              name="institution"
              value={values.institution}
              onChange={(event) => update("institution", event.target.value)}
              maxLength={120}
            />
          </Field>
        </div>

        <Field
          id="lecturerName"
          label="Lecturer or instructor"
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
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-base font-semibold">Application details</legend>

        <Field
          id="description"
          label="Class description"
          error={fieldErrors.description}
          required
          hint="What the class covers and who it is for. At least 10 characters."
        >
          <Textarea
            id="description"
            name="description"
            value={values.description}
            onChange={(event) => update("description", event.target.value)}
            rows={5}
            maxLength={5_000}
            required
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.description)}
          />
        </Field>

        <Field
          id="reason"
          label="Reason for creating the class"
          error={fieldErrors.reason}
          required
          hint="Explain your role and why this class should exist on StarsTask."
        >
          <Textarea
            id="reason"
            name="reason"
            value={values.reason}
            onChange={(event) => update("reason", event.target.value)}
            rows={4}
            maxLength={2_000}
            required
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.reason)}
          />
        </Field>

        <Field
          id="supportingInfo"
          label="Supporting information"
          error={fieldErrors.supportingInfo}
          hint="Optional. Do not include private student data."
        >
          <Textarea
            id="supportingInfo"
            name="supportingInfo"
            value={values.supportingInfo}
            onChange={(event) => update("supportingInfo", event.target.value)}
            rows={3}
            maxLength={2_000}
            aria-invalid={Boolean(fieldErrors.supportingInfo)}
          />
        </Field>
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
            "Submit application"
          ) : (
            "Resubmit application"
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

      <p className="text-muted-foreground text-xs leading-relaxed">
        Submitting an application does not create a class or grant any admin
        role. A platform admin must approve it, and they decide separately
        whether to make you the class admin.
      </p>
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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

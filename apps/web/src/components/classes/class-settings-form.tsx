"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { classMetadataUpdateSchema, toFieldErrors } from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ClassSettingsValues = {
  name: string;
  description: string;
  courseName: string;
  institution: string;
  lecturerName: string;
  semester: string;
  academicYear: string;
};

type ClassSettingsFormProps = {
  classSlug: string;
  initialValues: ClassSettingsValues;
};

/** Class admins may edit metadata for their own class; the slug stays fixed. */
export function ClassSettingsForm({
  classSlug,
  initialValues,
}: ClassSettingsFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState(initialValues);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);

  const update = (key: keyof ClassSettingsValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    setError(null);
    setMessage(null);
    setFieldErrors({});

    const parsed = classMetadataUpdateSchema.safeParse({
      name: values.name,
      description: values.description,
      courseName: values.courseName,
      institution: values.institution || undefined,
      lecturerName: values.lecturerName || undefined,
      semester: values.semester,
      academicYear: values.academicYear,
    });

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      setError("Please fix the highlighted fields.");
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch(`/api/classes/${classSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string; fieldErrors?: Record<string, string> };
        } | null;
        setFieldErrors(body?.error?.fieldErrors ?? {});
        setError(body?.error?.message ?? "Could not update the class.");
        return;
      }

      setMessage("Class details saved.");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-4"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="settings-name">Class name</Label>
          <Input
            id="settings-name"
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            maxLength={120}
            required
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name ? (
            <p className="text-danger text-xs">{fieldErrors.name}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-course">Course</Label>
          <Input
            id="settings-course"
            value={values.courseName}
            onChange={(event) => update("courseName", event.target.value)}
            maxLength={120}
            required
            aria-invalid={Boolean(fieldErrors.courseName)}
          />
          {fieldErrors.courseName ? (
            <p className="text-danger text-xs">{fieldErrors.courseName}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-semester">Semester</Label>
          <Input
            id="settings-semester"
            value={values.semester}
            onChange={(event) => update("semester", event.target.value)}
            maxLength={20}
            required
            aria-invalid={Boolean(fieldErrors.semester)}
          />
          {fieldErrors.semester ? (
            <p className="text-danger text-xs">{fieldErrors.semester}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-year">Academic year</Label>
          <Input
            id="settings-year"
            value={values.academicYear}
            onChange={(event) => update("academicYear", event.target.value)}
            maxLength={20}
            required
            placeholder="2025/2026"
            aria-invalid={Boolean(fieldErrors.academicYear)}
          />
          {fieldErrors.academicYear ? (
            <p className="text-danger text-xs">{fieldErrors.academicYear}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-institution">Institution</Label>
          <Input
            id="settings-institution"
            value={values.institution}
            onChange={(event) => update("institution", event.target.value)}
            maxLength={120}
            aria-invalid={Boolean(fieldErrors.institution)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-lecturer">Lecturer</Label>
          <Input
            id="settings-lecturer"
            value={values.lecturerName}
            onChange={(event) => update("lecturerName", event.target.value)}
            maxLength={120}
            aria-invalid={Boolean(fieldErrors.lecturerName)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settings-description">Description</Label>
        <Textarea
          id="settings-description"
          value={values.description}
          onChange={(event) => update("description", event.target.value)}
          rows={4}
          maxLength={5_000}
          required
          aria-invalid={Boolean(fieldErrors.description)}
        />
        {fieldErrors.description ? (
          <p className="text-danger text-xs">{fieldErrors.description}</p>
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={isBusy}
      >
        {isBusy ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
          />
        ) : null}
        Save class details
      </Button>
    </form>
  );
}

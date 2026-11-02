"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  CLASS_ACADEMIC_YEAR_PATTERN,
  CLASS_CODE_MAX,
  CLASS_NAME_MIN,
  classMetadataUpdateSchema,
  toFieldErrors,
  type ClassDuplicateMatch,
  type ClassJoinPolicy,
} from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ClassSettingsValues = {
  name: string;
  classCode: string;
  description: string;
  courseName: string;
  institution: string;
  lecturerName: string;
  semester: string;
  academicYear: string;
  joinPolicy: ClassJoinPolicy;
};

type ClassSettingsFormProps = {
  classSlug: string;
  classId: string;
  initialValues: ClassSettingsValues;
};

/** Class admins may edit metadata for their own class; the slug stays fixed. */
export function ClassSettingsForm({
  classSlug,
  classId,
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
  const [duplicates, setDuplicates] = React.useState<ClassDuplicateMatch[]>([]);

  const duplicateName = values.name.trim();
  const duplicateCode = values.classCode.trim();
  const duplicateYear = values.academicYear.trim();
  const duplicateSemester = values.semester.trim();
  const duplicateInstitution = values.institution.trim();
  const canCheckDuplicates =
    duplicateName.length >= CLASS_NAME_MIN &&
    duplicateSemester.length > 0 &&
    CLASS_ACADEMIC_YEAR_PATTERN.test(duplicateYear);

  React.useEffect(() => {
    if (!canCheckDuplicates) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({
        name: duplicateName,
        academicYear: duplicateYear,
        semester: duplicateSemester,
        excludeClassId: classId,
      });

      if (duplicateCode) {
        params.set("classCode", duplicateCode);
      }

      if (duplicateInstitution) {
        params.set("institution", duplicateInstitution);
      }

      try {
        const response = await fetch(
          `/api/classes/duplicates?${params.toString()}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          setDuplicates([]);
          return;
        }

        const body = (await response.json().catch(() => null)) as {
          data?: ClassDuplicateMatch[];
        } | null;

        setDuplicates(body?.data ?? []);
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setDuplicates([]);
        }
      }
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    canCheckDuplicates,
    duplicateName,
    duplicateCode,
    duplicateYear,
    duplicateSemester,
    duplicateInstitution,
    classId,
  ]);

  const update = <Key extends keyof ClassSettingsValues>(
    key: Key,
    value: ClassSettingsValues[Key],
  ) => {
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
      classCode: values.classCode || undefined,
      description: values.description,
      courseName: values.courseName,
      institution: values.institution || undefined,
      lecturerName: values.lecturerName || undefined,
      semester: values.semester,
      academicYear: values.academicYear,
      joinPolicy: values.joinPolicy,
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
        <Label htmlFor="settings-class-code">Class code</Label>
        <Input
          id="settings-class-code"
          value={values.classCode}
          onChange={(event) =>
            update("classCode", event.target.value.toUpperCase())
          }
          maxLength={CLASS_CODE_MAX}
          autoCapitalize="characters"
          placeholder="TPL-M002"
          aria-invalid={Boolean(fieldErrors.classCode)}
        />
        <p className="text-muted-foreground text-xs">
          Used to identify the class inside one academic period. The permanent
          identity is always the internal class id.
        </p>
        {fieldErrors.classCode ? (
          <p className="text-danger text-xs">{fieldErrors.classCode}</p>
        ) : null}
      </div>

      {canCheckDuplicates && duplicates.length > 0 ? (
        <Alert variant="warning">
          <p className="font-medium">
            Another class already uses this name or code in the same academic
            period.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {duplicates.map((match) => (
              <li key={match.classId}>
                {match.name}
                {match.classCode ? ` (${match.classCode})` : ""} ·{" "}
                {match.semester} · {match.academicYear}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Renaming or re-coding this class is allowed, but it will be saved
            under the same internal id. Nothing is merged automatically.
          </p>
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="settings-join-policy">Joining</Label>
        <Select
          id="settings-join-policy"
          value={values.joinPolicy}
          onChange={(event) =>
            update(
              "joinPolicy",
              event.target.value === "open" ? "open" : "invitation",
            )
          }
          aria-invalid={Boolean(fieldErrors.joinPolicy)}
        >
          <option value="invitation">Invitation only</option>
          <option value="open">Open by class name</option>
        </Select>
        <p className="text-muted-foreground text-xs">
          Invitation-only classes admit new members through an invitation link.
          An open class also lets a student join by typing its exact class name.
        </p>
        {fieldErrors.joinPolicy ? (
          <p className="text-danger text-xs">{fieldErrors.joinPolicy}</p>
        ) : null}
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

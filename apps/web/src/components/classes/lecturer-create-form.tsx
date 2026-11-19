"use client";

import { AlertTriangle, Loader2, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { toFieldErrors } from "@starstask/contracts";

import { lecturerCreateClassSchema } from "@/features/classes/lecturer-create-schemas";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const DESCRIPTION_MAX = 5000;

export type LecturerUniversityOption = { id: string; name: string };

type LecturerCreateFormProps = {
  /** Parent gates submission on session + lecturer persona; the route re-checks. */
  canSubmit?: boolean;
  /** Active lecturer/university_admin memberships read server-side. */
  universityOptions?: LecturerUniversityOption[];
};

type CreateResponse = {
  data?: { classId?: string; slug?: string; name?: string };
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
};

type FieldValues = {
  name: string;
  courseName: string;
  semester: string;
  academicYear: string;
  classCode: string;
  institution: string;
  lecturerName: string;
  description: string;
  universityId: string;
};

const EMPTY: FieldValues = {
  name: "",
  courseName: "",
  semester: "",
  academicYear: "",
  classCode: "",
  institution: "",
  lecturerName: "",
  description: "",
  universityId: "",
};

function currentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();

  return now.getMonth() >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

function toPayload(values: FieldValues) {
  return {
    ...values,
    classCode: values.classCode.trim() === "" ? undefined : values.classCode,
    institution: values.institution.trim() || undefined,
    lecturerName: values.lecturerName.trim() || undefined,
    universityId: values.universityId === "" ? undefined : values.universityId,
  };
}

type TextFieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  error?: string;
  hint?: string;
};

/** Label + input + single-line error/hint slot, shared by all text fields. */
function TextField({ label, error, hint, ...input }: TextFieldProps) {
  const id = input.id ?? label;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        {...input}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${id}-error` : hint ? `${id}-hint` : undefined
        }
        className={input.className ?? "h-11"}
      />
      {error ? (
        <p
          id={`${id}-error`}
          className="text-danger text-xs"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${id}-hint`}
          className="text-muted-foreground text-xs"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Lecturer self-service class creation form.
 *
 * The server owns authorization and membership resolution
 * (`create_class_as_lecturer`); this component collects fields, mirrors the
 * shared zod schema for early feedback, and renders the route's field errors.
 * `canSubmit` is advisory only.
 */
export function LecturerCreateForm({
  canSubmit = true,
  universityOptions = [],
}: LecturerCreateFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState<FieldValues>({
    ...EMPTY,
    academicYear: currentAcademicYear(),
  });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formError, setFormError] = React.useState<{
    code?: string;
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const hasMultipleMemberships = universityOptions.length > 1;
  // More than one membership: the RPC bounces unless a university is picked.
  const membershipPicked =
    !hasMultipleMemberships || values.universityId !== "";
  const payload = toPayload(values);
  const isDirty = Object.values(values).some(
    (value) => value.trim().length > 0,
  );
  const canSubmitNow =
    canSubmit &&
    isDirty &&
    membershipPicked &&
    lecturerCreateClassSchema.safeParse(payload).success;

  const update = (field: keyof FieldValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setFieldErrors({});
    setFormError(null);

    const parsed = lecturerCreateClassSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/classes/create-lecturer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response
        .json()
        .catch(() => null)) as CreateResponse | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fields ?? {});
        setFormError({
          code: body?.error?.code,
          message:
            body?.error?.message ??
            "Tidak bisa membuat kelas sekarang. Coba lagi.",
        });
        return;
      }

      if (body?.data?.slug) {
        router.push(`/classes/${encodeURIComponent(body.data.slug)}`);
        router.refresh();
        return;
      }

      setFormError({
        code: "unexpected_response",
        message:
          "Kelas dibuat, tetapi tidak bisa dibuka. Muat ulang halaman /classes.",
      });
    } catch {
      setFormError({
        message: "Gangguan jaringan. Periksa koneksi kamu lalu coba lagi.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showUniversityPicker =
    hasMultipleMemberships || formError?.code === "pick_university";
  const textInput = (
    field: keyof FieldValues,
    props: Omit<TextFieldProps, "value" | "onChange"> & {
      onChange?: (value: string) => void;
    },
  ) => (
    <TextField
      {...props}
      id={props.id ?? `lecturer-${field}`}
      label={props.label}
      value={values[field]}
      onChange={(event) =>
        (props.onChange ?? ((value) => update(field, value)))(
          event.target.value,
        )
      }
      disabled={isSubmitting}
      error={fieldErrors[field]}
    />
  );

  return (
    <form
      className="mt-6 space-y-5"
      onSubmit={submit}
      noValidate
    >
      {textInput("name", {
        label: "Class name",
        placeholder: "Kelas Riset Operasional A",
        maxLength: 120,
      })}
      {textInput("courseName", {
        label: "Course name",
        placeholder: "Riset Operasional",
        maxLength: 120,
      })}
      <div className="grid gap-4 sm:grid-cols-2">
        {textInput("semester", {
          label: "Semester",
          placeholder: "Semester 5",
          maxLength: 20,
        })}
        {textInput("academicYear", {
          label: "Academic year",
          placeholder: "2026/2027",
          pattern: "\\d{4}/\\d{4}",
          maxLength: 9,
          hint: "Format YYYY/YYYY, misalnya 2026/2027.",
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {textInput("classCode", {
          label: "Class code (opsional)",
          placeholder: "TPLM002",
          maxLength: 20,
          autoCapitalize: "characters",
          className: "h-11 uppercase",
          onChange: (value) => update("classCode", value.toUpperCase()),
        })}
        {textInput("institution", {
          label: "Institution (opsional)",
          placeholder: "Institut Teknologi Bandung",
          maxLength: 120,
        })}
      </div>
      {textInput("lecturerName", {
        label: "Lecture name (opsional)",
        placeholder: "Default dari nama profil kamu",
        maxLength: 120,
      })}

      {showUniversityPicker ? (
        <div className="space-y-1.5">
          <Label htmlFor="lecturer-university">University</Label>
          {universityOptions.length > 0 ? (
            <>
              <Select
                id="lecturer-university"
                value={values.universityId}
                onChange={(event) => update("universityId", event.target.value)}
                disabled={isSubmitting}
                className="h-11"
              >
                <option value="">Pilih university...</option>
                {universityOptions.map((option) => (
                  <option
                    key={option.id}
                    value={option.id}
                  >
                    {option.name}
                  </option>
                ))}
              </Select>
              <p className="text-muted-foreground text-xs">
                Kamu punya lebih dari satu membership lecturer aktif. Pilih
                university untuk kelas ini.
              </p>
            </>
          ) : (
            <Alert variant="warning">
              <p className="flex items-start gap-2">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>
                  Kamu punya lebih dari satu membership lecturer aktif. Kelola
                  membership kamu di{" "}
                  <Link
                    href="/settings/profile#lecturer"
                    className="font-medium underline"
                  >
                    /settings/profile
                  </Link>
                  .
                </span>
              </p>
            </Alert>
          )}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="lecturer-description">Description</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {values.description.trim().length}/{DESCRIPTION_MAX}
          </span>
        </div>
        <Textarea
          id="lecturer-description"
          value={values.description}
          onChange={(event) =>
            update("description", event.target.value.slice(0, DESCRIPTION_MAX))
          }
          placeholder="Ruang kerja kelas untuk penugasan, kehadiran, dan jadwal."
          maxLength={DESCRIPTION_MAX}
          rows={4}
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby="lecturer-description-hint"
        />
        {fieldErrors.description ? (
          <p className="text-danger text-xs">{fieldErrors.description}</p>
        ) : (
          <p
            id="lecturer-description-hint"
            className="text-muted-foreground text-xs"
          >
            Minimal 10 karakter.
          </p>
        )}
      </div>

      {formError ? (
        <Alert variant="error">
          <p>{formError.message}</p>
          {formError.code === "pick_university" &&
          universityOptions.length === 0 ? (
            <p className="mt-2">
              <Link
                href="/settings/profile#lecturer"
                className="font-medium underline"
              >
                Kelola membership lecturer
              </Link>
            </p>
          ) : null}
        </Alert>
      ) : null}

      <Button
        type="submit"
        disabled={!canSubmitNow || isSubmitting}
        aria-busy={isSubmitting}
        className="h-11 w-full"
      >
        {isSubmitting ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
          />
        ) : (
          <PlusCircle
            aria-hidden="true"
            className="h-4 w-4"
          />
        )}
        {isSubmitting ? "Membuat..." : "Buat kelas"}
      </Button>
    </form>
  );
}

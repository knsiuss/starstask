"use client";

import { Camera, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  maskNim,
  profileOnboardingSchema,
  toFieldErrors,
  type ClassJoinResult,
} from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ProfileOnboardingInitialValues = {
  fullName: string;
  nickname: string;
  nim: string;
  university: string;
  className: string;
  avatarUrl: string | null;
};

type ProfileOnboardingFormProps = {
  initialValues: ProfileOnboardingInitialValues;
  /** Validated internal path to continue to after a successful save. */
  nextPath: string;
};

type FieldName = keyof ProfileOnboardingInitialValues;

const FIELD_IDS: Record<string, string> = {
  fullName: "fullName",
  nickname: "nickname",
  nim: "nim",
  university: "university",
  className: "className",
};

/**
 * Single-page profile setup.
 *
 * One request saves the text fields, the optional photo, and the class attempt,
 * so the outcome the student sees is the outcome that was persisted. The photo
 * is validated and stored server-side; the browser never decides a file is
 * acceptable.
 */
export function ProfileOnboardingForm({
  initialValues,
  nextPath,
}: ProfileOnboardingFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState(initialValues);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formMessage, setFormMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [completed, setCompleted] = React.useState<{
    classJoin: ClassJoinResult | null;
    classNameAtSave: string;
  } | null>(null);

  const previewUrl = React.useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : null),
    [avatarFile],
  );

  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const update = (key: FieldName, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    setAvatarFile(file);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setFieldErrors({});
    setFormMessage(null);

    const parsed = profileOnboardingSchema.safeParse({
      fullName: values.fullName,
      nickname: values.nickname,
      nim: values.nim,
      university: values.university,
      className: values.className,
    });

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);

      setFieldErrors(errors);
      focusFirstError(errors);
      return;
    }

    const formData = new FormData();

    formData.set("fullName", parsed.data.fullName);
    formData.set("nickname", parsed.data.nickname);
    formData.set("nim", parsed.data.nim);
    formData.set("university", parsed.data.university);
    formData.set("className", parsed.data.className ?? "");

    if (avatarFile) {
      formData.set("avatar", avatarFile);
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/profile/onboarding", {
        method: "POST",
        body: formData,
      });

      const body = (await response.json().catch(() => null)) as {
        data?: { classJoin?: ClassJoinResult | null };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        const errors = body?.error?.fieldErrors ?? {};

        setFieldErrors(errors);
        setFormMessage(
          body?.error?.message ?? "Could not save your profile. Try again.",
        );
        focusFirstError(errors);
        return;
      }

      setCompleted({
        classJoin: body?.data?.classJoin ?? null,
        classNameAtSave: parsed.data.className ?? "",
      });
    } catch {
      setFormMessage("Network error. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (completed) {
    return (
      <CompletionPanel
        classJoin={completed.classJoin}
        classNameAtSave={completed.classNameAtSave}
        onContinue={() => {
          router.push(nextPath);
          router.refresh();
        }}
      />
    );
  }

  const previewSrc = previewUrl ?? values.avatarUrl;
  const initials = getInitials(values.nickname || values.fullName);

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="border-border bg-surface w-full max-w-xl rounded-lg border p-6 shadow-[0_1px_2px_rgba(9,9,11,0.04)] sm:p-8"
    >
      <h1 className="text-2xl font-semibold tracking-tight">
        Set up your profile
      </h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        A couple of details so your classmates and lecturers know who you are.
        You can change these later.
      </p>

      {formMessage ? (
        <Alert
          variant="error"
          className="mt-5"
        >
          {formMessage}
        </Alert>
      ) : null}

      <div className="mt-6 space-y-6">
        <div className="flex items-center gap-4">
          {previewSrc ? (
            // A blob: or https: avatar URL; next/image adds no value for a
            // user-supplied URL we already control.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt=""
              className="border-border h-16 w-16 rounded-full border object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              aria-hidden="true"
              className="bg-accent-soft text-accent flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold"
            >
              {initials}
            </span>
          )}

          <div className="space-y-1.5">
            <label className="border-border bg-surface text-foreground hover:bg-muted focus-within:outline-accent inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium focus-within:outline-2 focus-within:outline-offset-2">
              <Camera
                aria-hidden="true"
                className="h-4 w-4"
              />
              Choose a photo
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={handleAvatarChange}
              />
            </label>
            <p className="text-muted-foreground text-xs">
              Optional. PNG or JPG, up to 2 MB. We use your Google photo by
              default.
            </p>
          </div>
        </div>

        <Field
          id="fullName"
          label="Full name"
          error={fieldErrors.fullName}
          hint="Your legal name. Only you and administrators who need it can see it."
          required
        >
          <Input
            id="fullName"
            name="fullName"
            value={values.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            maxLength={80}
            autoComplete="name"
            required
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.fullName)}
          />
        </Field>

        <Field
          id="nickname"
          label="Nickname"
          error={fieldErrors.nickname}
          hint="How you appear to other students. We use this instead of your full name wherever possible."
          required
        >
          <Input
            id="nickname"
            name="nickname"
            value={values.nickname}
            onChange={(event) => update("nickname", event.target.value)}
            maxLength={60}
            autoComplete="nickname"
            required
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.nickname)}
          />
        </Field>

        <Field
          id="nim"
          label="NIM (Student ID)"
          error={fieldErrors.nim}
          hint={
            values.nim.trim().length > 0
              ? `Private. Anywhere it must be shown outside your account, it reads ${maskNim(
                  values.nim,
                )}.`
              : "Kept private. Leading zeros are preserved."
          }
          required
        >
          <Input
            id="nim"
            name="nim"
            value={values.nim}
            onChange={(event) => update("nim", event.target.value)}
            maxLength={32}
            inputMode="text"
            autoComplete="off"
            required
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.nim)}
            placeholder="e.g. 2024010767"
          />
        </Field>

        <Field
          id="university"
          label="University"
          error={fieldErrors.university}
          required
        >
          <Input
            id="university"
            name="university"
            value={values.university}
            onChange={(event) => update("university", event.target.value)}
            maxLength={120}
            autoComplete="organization"
            required
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.university)}
            placeholder="e.g. Universitas Indonesia"
          />
        </Field>

        <Field
          id="className"
          label="Class / Kelas"
          error={fieldErrors.className}
          hint="Optional. Type your class code as your university writes it. It is saved either way; if it matches an open class we also add you to it."
        >
          <Input
            id="className"
            name="className"
            value={values.className}
            onChange={(event) => update("className", event.target.value)}
            maxLength={60}
            autoComplete="off"
            aria-invalid={Boolean(fieldErrors.className)}
            placeholder="e.g. IF-24-01"
          />
        </Field>
      </div>

      <div className="mt-8">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : null}
          {isSubmitting ? "Saving..." : "Save and continue"}
        </Button>
      </div>
    </form>
  );
}

function CompletionPanel({
  classJoin,
  classNameAtSave,
  onContinue,
}: {
  classJoin: ClassJoinResult | null;
  classNameAtSave: string;
  onContinue: () => void;
}) {
  return (
    <div className="border-border bg-surface w-full max-w-xl rounded-lg border p-6 shadow-[0_1px_2px_rgba(9,9,11,0.04)] sm:p-8">
      <div className="flex items-center gap-2">
        <span className="bg-success-soft text-success flex h-8 w-8 items-center justify-center rounded-full">
          <Check
            aria-hidden="true"
            className="h-4 w-4"
          />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">
          Your profile is ready
        </h1>
      </div>

      <div className="mt-5">
        <ClassOutcome
          classJoin={classJoin}
          classNameAtSave={classNameAtSave}
        />
      </div>

      <div className="mt-8">
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={onContinue}
        >
          Continue to StarsTask
        </Button>
      </div>
    </div>
  );
}

function ClassOutcome({
  classJoin,
  classNameAtSave,
}: {
  classJoin: ClassJoinResult | null;
  classNameAtSave: string;
}) {
  if (!classNameAtSave) {
    return (
      <Alert variant="info">
        Saved. You did not enter a class, so we did not join you to one. You can
        join later from My Classes.
      </Alert>
    );
  }

  switch (classJoin?.status) {
    case "joined":
      return (
        <Alert variant="success">
          Joined <strong>{classJoin.name}</strong>. Open My Classes to see its
          assignments.
        </Alert>
      );
    case "already_member":
      return (
        <Alert variant="info">
          You are already a member of <strong>{classJoin.name}</strong>.
        </Alert>
      );
    case "blocked_by_policy":
      return (
        <Alert variant="info">
          Found <strong>{classJoin.name}</strong>, but this class joins by
          invitation only. Ask a class admin for an invite link.
        </Alert>
      );
    case "ambiguous":
      return (
        <Alert variant="warning">
          More than one class matches <strong>{classNameAtSave}</strong>, so we
          did not join any of them:{" "}
          {classJoin.candidates.map((candidate) => candidate.name).join(", ")}.
          Ask a class admin for an invite link to the right one.
        </Alert>
      );
    default:
      return (
        <Alert variant="info">
          Saved. <strong>{classNameAtSave}</strong> is recorded as your class.
          Class workspaces join by invite link, so ask a class admin when you
          are ready.
        </Alert>
      );
  }
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "ST";
  }

  const first = parts[0]?.charAt(0) ?? "";
  const second = parts.length > 1 ? (parts[1]?.charAt(0) ?? "") : "";

  return `${first}${second}`.toUpperCase();
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

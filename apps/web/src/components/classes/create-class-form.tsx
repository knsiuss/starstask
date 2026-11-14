"use client";

import { Loader2, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { studentCreateClassSchema, toFieldErrors } from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

type CreateResponse = {
  data?: { classId?: string };
  error?: { message?: string; fields?: Record<string, string> };
};

const SEMESTERS = ["Ganjil", "Genap", "Pendek"] as const;

function currentAcademicYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${start + 1}`;
}

/**
 * Student self-created class form.
 *
 * The database owns every rule (`create_class_as_student`): slug format,
 * field lengths, the 3-active-class abuse cap, and naming the creator ketua.
 * This only validates input and reports the outcome.
 */
export function CreateClassForm() {
  const router = useRouter();
  const [values, setValues] = React.useState({
    name: "",
    slug: "",
    courseName: "",
    semester: "Ganjil",
    academicYear: currentAcademicYear(),
    description: "",
    joinPolicy: "invitation" as "invitation" | "open",
  });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formMessage, setFormMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [createdId, setCreatedId] = React.useState<string | null>(null);

  const update = (key: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setFieldErrors({});
    setFormMessage(null);
    setCreatedId(null);

    const parsed = studentCreateClassSchema.safeParse(values);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/classes/create-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response
        .json()
        .catch(() => null)) as CreateResponse | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fields ?? {});
        setFormMessage(
          body?.error?.message ?? "Could not create your class. Try again.",
        );
        return;
      }

      setCreatedId(body?.data?.classId ?? null);
      router.refresh();
    } catch {
      setFormMessage("Network error. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdId) {
    return (
      <Alert variant="success">
        <p className="inline-flex items-center gap-1.5 font-medium">
          <PlusCircle
            aria-hidden="true"
            className="h-4 w-4"
          />
          Your class is ready
        </p>
        <p className="mt-1 text-sm">
          You were added as the first member and ketua kelas. Share the
          invitation link from the class page so your classmates can join.
        </p>
      </Alert>
    );
  }

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="create-name">Class name</Label>
          <Input
            id="create-name"
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="TPLM002 - Kelompok 3"
            maxLength={120}
            aria-invalid={Boolean(fieldErrors.name)}
            className="h-11"
          />
          {fieldErrors.name ? (
            <p className="text-danger text-xs">{fieldErrors.name}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-slug">Class code</Label>
          <Input
            id="create-slug"
            value={values.slug}
            onChange={(event) => update("slug", event.target.value)}
            placeholder="tplm002-k3"
            maxLength={80}
            autoCapitalize="none"
            aria-invalid={Boolean(fieldErrors.slug)}
            className="h-11"
          />
          {fieldErrors.slug ? (
            <p className="text-danger text-xs">{fieldErrors.slug}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="create-course">Course</Label>
          <Input
            id="create-course"
            value={values.courseName}
            onChange={(event) => update("courseName", event.target.value)}
            placeholder="Teknik Persamaan Diferensial"
            maxLength={120}
            aria-invalid={Boolean(fieldErrors.courseName)}
            className="h-11"
          />
          {fieldErrors.courseName ? (
            <p className="text-danger text-xs">{fieldErrors.courseName}</p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="create-semester">Semester</Label>
            <Select
              id="create-semester"
              value={values.semester}
              onChange={(event) => update("semester", event.target.value)}
            >
              {SEMESTERS.map((semester) => (
                <option
                  key={semester}
                  value={semester}
                >
                  {semester}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-year">Academic year</Label>
            <Input
              id="create-year"
              value={values.academicYear}
              onChange={(event) => update("academicYear", event.target.value)}
              placeholder="2026/2027"
              maxLength={9}
              inputMode="numeric"
              aria-invalid={Boolean(fieldErrors.academicYear)}
              className="h-11"
            />
            {fieldErrors.academicYear ? (
              <p className="text-danger text-xs">{fieldErrors.academicYear}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-description">What is this class for?</Label>
        <Textarea
          id="create-description"
          value={values.description}
          onChange={(event) => update("description", event.target.value)}
          placeholder="Kelompok belajar untuk tugas akhir, revisi, dan diskusi soal."
          maxLength={5000}
          aria-invalid={Boolean(fieldErrors.description)}
        />
        {fieldErrors.description ? (
          <p className="text-danger text-xs">{fieldErrors.description}</p>
        ) : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-foreground text-sm font-medium">
          Who can join?
        </legend>
        <label className="border-border bg-subtle flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
          <input
            type="radio"
            name="joinPolicy"
            value="invitation"
            checked={values.joinPolicy === "invitation"}
            onChange={() => update("joinPolicy", "invitation")}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Invitation only</span>
            <span className="text-muted-foreground block text-xs">
              You share the link yourself; nobody else can find the class.
            </span>
          </span>
        </label>
        <label className="border-border bg-subtle flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
          <input
            type="radio"
            name="joinPolicy"
            value="open"
            checked={values.joinPolicy === "open"}
            onChange={() => update("joinPolicy", "open")}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Open to anyone with the code</span>
            <span className="text-muted-foreground block text-xs">
              Anyone who types the class code can join without an invitation.
            </span>
          </span>
        </label>
      </fieldset>

      {formMessage ? <Alert variant="error">{formMessage}</Alert> : null}

      <Button
        type="submit"
        disabled={isSubmitting}
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
        {isSubmitting ? "Creating..." : "Create class"}
      </Button>
    </form>
  );
}

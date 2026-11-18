"use client";

import { ArrowRight, Loader2, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  buildCanonicalClassIdentity,
  studentCreateClassSchema,
  toFieldErrors,
} from "@starstask/contracts";

import type { ClassLookupMatch } from "@/app/api/classes/lookup/route";
import { ClassCourseJoinDialog } from "@/components/classes/class-course-join-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type CreateResponse = {
  data?: { classId?: string; slug?: string; name?: string };
  error?: { code?: string; message?: string; fields?: Record<string, string> };
};

const SEMESTERS = Array.from({ length: 14 }, (_, index) => index + 1);

function currentAcademicPeriod(): { year: string; term: "Ganjil" | "Genap" } {
  const now = new Date();
  const month = now.getMonth();
  const fullYear = now.getFullYear();

  if (month >= 7) {
    return { year: `${fullYear}/${fullYear + 1}`, term: "Ganjil" };
  }

  return { year: `${fullYear - 1}/${fullYear}`, term: "Genap" };
}

function currentAcademicYear(): string {
  return currentAcademicPeriod().year;
}

/**
 * Student self-created class form.
 *
 * Derives a deterministic class identity (`05TPLM002-24/25` and slug
 * `05tplm002-24-25`) from `(semesterNumber, classCode, academicYear)` so the
 * same cohort class cannot be created twice.
 */
export function CreateClassForm() {
  const router = useRouter();
  const [values, setValues] = React.useState({
    classCode: "",
    semesterNumber: 5,
    academicYear: currentAcademicYear(),
    courseName: "",
    description: "",
    joinPolicy: "invitation" as "invitation" | "open",
  });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formError, setFormError] = React.useState<{
    code?: string;
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [created, setCreated] = React.useState<{
    id: string;
    slug?: string;
    name?: string;
  } | null>(null);
  const [lookupMatches, setLookupMatches] = React.useState<ClassLookupMatch[]>(
    [],
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pendingPayload, setPendingPayload] = React.useState<unknown>(null);

  const preview = React.useMemo(() => {
    const code = values.classCode.trim().toUpperCase();
    const yearValid = /^\d{4}\/\d{4}$/.test(values.academicYear.trim());

    if (!/^[A-Z0-9]{2,20}$/.test(code) || !yearValid) {
      return null;
    }

    return buildCanonicalClassIdentity({
      classCode: code,
      semesterNumber: values.semesterNumber,
      academicYear: values.academicYear,
    });
  }, [values.academicYear, values.classCode, values.semesterNumber]);

  const clearFieldError = (key: string) => {
    setFieldErrors((current) => {
      if (!current[key]) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const executeCreate = async (payloadData: unknown) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/classes/create-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadData),
      });
      const body = (await response
        .json()
        .catch(() => null)) as CreateResponse | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fields ?? {});
        setFormError({
          code: body?.error?.code,
          message:
            body?.error?.message ?? "Could not create your class. Try again.",
        });
        return;
      }

      setCreated({
        id: body?.data?.classId ?? "",
        slug: body?.data?.slug,
        name: body?.data?.name,
      });
      router.refresh();
    } catch {
      setFormError({
        message: "Network error. Check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setCreated(null);

    const parsed = studentCreateClassSchema.safeParse(values);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);

    try {
      const lookupRes = await fetch("/api/classes/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classCode: parsed.data.classCode,
          semesterNumber: parsed.data.semesterNumber,
          academicYear: parsed.data.academicYear,
        }),
      });
      const lookupBody = (await lookupRes.json().catch(() => null)) as {
        data?: { found?: boolean; matches?: ClassLookupMatch[] };
      } | null;

      const matches = lookupBody?.data?.matches ?? [];

      if (lookupRes.ok && lookupBody?.data?.found && matches.length > 0) {
        setPendingPayload(parsed.data);
        setLookupMatches(matches);
        setDialogOpen(true);
        setIsSubmitting(false);
        return;
      }
    } catch {
      // Fall through to creation if lookup fails transiently; RPC still guards canonical duplicates.
    }

    await executeCreate(parsed.data);
  };

  if (created?.id) {
    return (
      <Alert variant="success">
        <p className="inline-flex items-center gap-1.5 font-medium">
          <PlusCircle
            aria-hidden="true"
            className="h-4 w-4"
          />
          {created.name
            ? `Class ${created.name} is ready`
            : "Your class is ready"}
        </p>
        <p className="mt-1 text-sm">
          You were added as the first member and class admin. Share the
          invitation link from the class page so your classmates can join.
        </p>
        {created.slug ? (
          <div className="mt-4">
            <Button
              asChild
              size="sm"
              className="min-h-[44px] sm:min-h-9"
            >
              <Link href={`/classes/${encodeURIComponent(created.slug)}`}>
                Open class
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </Link>
            </Button>
          </div>
        ) : null}
      </Alert>
    );
  }

  return (
    <>
      <form
        className="mt-6 space-y-5"
        onSubmit={submit}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="create-code">Class code</Label>
            <Input
              id="create-code"
              value={values.classCode}
              onChange={(event) => {
                setValues((c) => ({
                  ...c,
                  classCode: event.target.value.toUpperCase(),
                }));
                clearFieldError("classCode");
              }}
              placeholder="TPLM002"
              maxLength={20}
              autoCapitalize="characters"
              aria-invalid={Boolean(fieldErrors.classCode)}
              className="h-11 uppercase"
            />
            {fieldErrors.classCode ? (
              <p className="text-danger text-xs">{fieldErrors.classCode}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-semester">Semester</Label>
            <Select
              id="create-semester"
              value={String(values.semesterNumber)}
              onChange={(event) => {
                setValues((c) => ({
                  ...c,
                  semesterNumber: Number(event.target.value),
                }));
                clearFieldError("semesterNumber");
              }}
              className="h-11"
            >
              {SEMESTERS.map((semester) => (
                <option
                  key={semester}
                  value={semester}
                >
                  Semester {semester}
                </option>
              ))}
            </Select>
            {fieldErrors.semesterNumber ? (
              <p className="text-danger text-xs">
                {fieldErrors.semesterNumber}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-year">
              Academic year ({currentAcademicPeriod().term})
            </Label>
            <Input
              id="create-year"
              value={values.academicYear}
              readOnly
              aria-readonly="true"
              className="bg-muted/60 h-11"
            />
          </div>
        </div>

        <div className="border-border bg-subtle rounded-lg border px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs font-medium">
              Generated class ID
            </span>
            <span className="text-foreground font-mono text-sm font-semibold">
              {preview ? preview.name : "05TPLM002-24/25"}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {preview
              ? `URL code: ${preview.slug}. Duplicate classes for the same code, semester, and academic year are blocked automatically.`
              : "Format combines semester, class code, and academic year so existing classes cannot be duplicated."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="create-course">First course</Label>
          <Input
            id="create-course"
            value={values.courseName}
            onChange={(event) => {
              setValues((c) => ({ ...c, courseName: event.target.value }));
              clearFieldError("courseName");
            }}
            placeholder="Pemrograman Web 1"
            maxLength={120}
            aria-invalid={Boolean(fieldErrors.courseName)}
            className="h-11"
          />
          {fieldErrors.courseName ? (
            <p className="text-danger text-xs">{fieldErrors.courseName}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="create-description">What is this class for?</Label>
          <Textarea
            id="create-description"
            value={values.description}
            onChange={(event) => {
              setValues((c) => ({ ...c, description: event.target.value }));
              clearFieldError("description");
            }}
            placeholder="Class workspace for assignments, attendance, and schedules."
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
          <label className="border-border bg-subtle flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm">
            <input
              type="radio"
              name="joinPolicy"
              value="invitation"
              checked={values.joinPolicy === "invitation"}
              onChange={() =>
                setValues((c) => ({ ...c, joinPolicy: "invitation" }))
              }
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Invitation only</span>
              <span className="text-muted-foreground block text-xs">
                You share the link yourself; nobody else can join without an
                invite.
              </span>
            </span>
          </label>
          <label className="border-border bg-subtle flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm">
            <input
              type="radio"
              name="joinPolicy"
              value="open"
              checked={values.joinPolicy === "open"}
              onChange={() => setValues((c) => ({ ...c, joinPolicy: "open" }))}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Open to anyone with the code</span>
              <span className="text-muted-foreground block text-xs">
                Classmates who search the class code can join without an
                invitation.
              </span>
            </span>
          </label>
        </fieldset>

        {formError ? (
          <Alert
            variant="error"
            role="alert"
          >
            <p>{formError.message}</p>
            {formError.code === "slug_taken" ? (
              <p className="mt-2">
                <Link
                  href="/classes/join"
                  className="font-medium underline"
                >
                  Go to Join a class
                </Link>
              </p>
            ) : null}
          </Alert>
        ) : null}

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

      <ClassCourseJoinDialog
        matches={lookupMatches}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreateAnyway={() => {
          setDialogOpen(false);
          if (pendingPayload) {
            void executeCreate(pendingPayload);
          }
        }}
      />
    </>
  );
}

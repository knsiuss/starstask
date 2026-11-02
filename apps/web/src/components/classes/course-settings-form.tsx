"use client";

import { Archive, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  classSubjectUpdateSchema,
  toFieldErrors,
  type ClassSubjectView,
} from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CourseSettingsFormProps = {
  classSlug: string;
  course: ClassSubjectView;
};

type FormValues = {
  name: string;
  code: string;
  lecturerName: string;
  description: string;
};

type Message = { variant: "success" | "error"; text: string };

/**
 * Course-level settings: details and visibility.
 *
 * The API owns authorization and validation; this form only sends the current
 * values along with the field the admin changed.
 */
export function CourseSettingsForm({
  classSlug,
  course,
}: CourseSettingsFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState<FormValues>({
    name: course.name,
    code: course.code ?? "",
    lecturerName: course.lecturer_name ?? "",
    description: course.description ?? "",
  });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [message, setMessage] = React.useState<Message | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isStatusBusy, setIsStatusBusy] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const update = <Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const send = async (status: "active" | "archived"): Promise<boolean> => {
    setFieldErrors({});
    setMessage(null);

    const parsed = classSubjectUpdateSchema.safeParse({
      name: values.name,
      code: values.code.trim() || undefined,
      lecturerName: values.lecturerName.trim() || undefined,
      description: values.description.trim() || undefined,
      status,
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return false;
    }

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/subjects/${course.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fieldErrors ?? {});
        setMessage({
          variant: "error",
          text: body?.error?.message ?? "Could not update the course.",
        });
        return false;
      }

      router.refresh();
      return true;
    } catch {
      setMessage({
        variant: "error",
        text: "Network error. Check your connection and try again.",
      });
      return false;
    }
  };

  const saveDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving || isStatusBusy) {
      return;
    }

    setIsSaving(true);

    const saved = await send(course.status);

    if (saved) {
      setMessage({ variant: "success", text: "Course details saved." });
    }

    setIsSaving(false);
  };

  const changeVisibility = async (status: "active" | "archived") => {
    if (isSaving || isStatusBusy) {
      return;
    }

    setConfirmOpen(false);
    setIsStatusBusy(true);

    const saved = await send(status);

    if (saved) {
      setMessage({
        variant: "success",
        text:
          status === "archived"
            ? "Course archived. Its records stay available."
            : "Course reactivated. New content can be added again.",
      });
    }

    setIsStatusBusy(false);
  };

  return (
    <div className="mt-6 space-y-8">
      {message ? <Alert variant={message.variant}>{message.text}</Alert> : null}

      <section
        aria-labelledby="course-details"
        className="border-border bg-surface rounded-xl border p-5"
      >
        <h2
          id="course-details"
          className="text-base font-semibold tracking-tight"
        >
          Course information
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          These details appear on every page of this course.
        </p>

        <form
          onSubmit={saveDetails}
          noValidate
          className="mt-4 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="course-settings-name">Name</Label>
              <Input
                id="course-settings-name"
                value={values.name}
                onChange={(event) => update("name", event.target.value)}
                maxLength={120}
                aria-invalid={Boolean(fieldErrors.name)}
              />
              {fieldErrors.name ? (
                <p className="text-danger text-xs">{fieldErrors.name}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-settings-code">Code (optional)</Label>
              <Input
                id="course-settings-code"
                value={values.code}
                onChange={(event) => update("code", event.target.value)}
                maxLength={20}
                aria-invalid={Boolean(fieldErrors.code)}
              />
              {fieldErrors.code ? (
                <p className="text-danger text-xs">{fieldErrors.code}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="course-settings-lecturer">
              Lecturer (optional)
            </Label>
            <Input
              id="course-settings-lecturer"
              value={values.lecturerName}
              onChange={(event) => update("lecturerName", event.target.value)}
              maxLength={120}
              aria-invalid={Boolean(fieldErrors.lecturerName)}
            />
            {fieldErrors.lecturerName ? (
              <p className="text-danger text-xs">{fieldErrors.lecturerName}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="course-settings-description">
              Description (optional)
            </Label>
            <Textarea
              id="course-settings-description"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              rows={3}
              maxLength={2_000}
              aria-invalid={Boolean(fieldErrors.description)}
            />
            {fieldErrors.description ? (
              <p className="text-danger text-xs">{fieldErrors.description}</p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || isStatusBusy || !values.name.trim()}
            >
              {isSaving ? (
                <Loader2
                  aria-hidden="true"
                  className="mr-1.5 h-3.5 w-3.5 animate-spin"
                />
              ) : null}
              Save changes
            </Button>
          </div>
        </form>
      </section>

      <section
        id="visibility"
        aria-labelledby="course-visibility"
        className="border-border bg-surface scroll-mt-24 rounded-xl border p-5"
      >
        <h2
          id="course-visibility"
          className="text-base font-semibold tracking-tight"
        >
          Visibility
        </h2>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          {course.status === "active"
            ? "This course is active. Members can open it and admins can add content."
            : "This course is archived. Everything stays readable, but nothing new can be added."}
        </p>

        <div className="mt-4">
          {course.status === "active" ? (
            <Dialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
            >
              <DialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  disabled={isSaving || isStatusBusy}
                >
                  <Archive
                    aria-hidden="true"
                    className="mr-1.5 h-3.5 w-3.5"
                  />
                  Archive course
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Archive this course?</DialogTitle>
                <DialogDescription>
                  New assignments, materials, announcements, and meetings are
                  blocked. Existing content and attendance records stay
                  available, and you can reactivate the course later.
                </DialogDescription>

                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => void changeVisibility("archived")}
                    disabled={isStatusBusy}
                  >
                    {isStatusBusy ? (
                      <Loader2
                        aria-hidden="true"
                        className="mr-1.5 h-3.5 w-3.5 animate-spin"
                      />
                    ) : null}
                    Archive course
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => void changeVisibility("active")}
              disabled={isSaving || isStatusBusy}
            >
              {isStatusBusy ? (
                <Loader2
                  aria-hidden="true"
                  className="mr-1.5 h-3.5 w-3.5 animate-spin"
                />
              ) : (
                <RotateCcw
                  aria-hidden="true"
                  className="mr-1.5 h-3.5 w-3.5"
                />
              )}
              Reactivate course
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

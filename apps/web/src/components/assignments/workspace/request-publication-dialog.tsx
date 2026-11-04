"use client";

import {
  CalendarDays,
  CircleCheck,
  Clock,
  FilePlus2,
  Info,
  Loader2,
  Plus,
  Send,
} from "lucide-react";
import * as React from "react";

import {
  AssignmentPreview,
  AssignmentTips,
  PublicationPermissionCard,
} from "@/components/assignments/workspace/assignment-preview";
import { FileDropzone } from "@/components/assignments/workspace/file-dropzone";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { WorkspaceClassOption } from "@/lib/db/assignment-workspace";
import { ASSIGNMENT_TITLE_MAX } from "@starstask/contracts";

type Props = {
  classes: WorkspaceClassOption[];
  /** Admins create assignments; students request publication. */
  mode: "create" | "request";
};

const DESCRIPTION_MAX = 20_000;

/**
 * Class assignment submission dialog.
 *
 * One component serves both roles: for a class the member administers, the
 * existing submissions route publishes immediately; anywhere else the row is
 * stored as `pending_review` and a class admin reviews it. The modal says so
 * next to the class picker and in the footer, because that distinction is the
 * whole point of the request flow.
 */
export function RequestPublicationDialog({ classes, mode }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [classId, setClassId] = React.useState(classes[0]?.id ?? "");
  const [subjectId, setSubjectId] = React.useState(
    classes[0]?.subjects[0]?.id ?? "",
  );
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [deadlineDate, setDeadlineDate] = React.useState("");
  const [deadlineTime, setDeadlineTime] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );

  const selected = classes.find((item) => item.id === classId);
  const selectedSubject = selected?.subjects.find((s) => s.id === subjectId);
  const publishesDirectly = selected?.is_admin === true;
  const triggerLabel =
    mode === "create" ? "Create Assignment" : "Request Task Publication";

  const deadlineIso = React.useMemo(() => {
    if (!deadlineDate) {
      return "";
    }

    const time = deadlineTime || "23:59";
    const parsed = new Date(`${deadlineDate}T${time}`);

    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }, [deadlineDate, deadlineTime]);

  const pickClass = (nextClassId: string) => {
    setClassId(nextClassId);
    const next = classes.find((item) => item.id === nextClassId);
    setSubjectId(next?.subjects[0]?.id ?? "");
  };

  const reset = () => {
    setTitle("");
    setDescription("");
    setDeadlineDate("");
    setDeadlineTime("");
    setFiles([]);
    setError(null);
    setFieldErrors({});
    pickClass(classes[0]?.id ?? "");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving || !selected) {
      return;
    }

    const nextErrors: Record<string, string> = {};

    if (title.trim().length < 3) {
      nextErrors.title = "Title must be at least 3 characters";
    }

    if (description.trim().length < 10) {
      nextErrors.description = "Description must be at least 10 characters";
    }

    if (!subjectId) {
      nextErrors.subjectId = "Choose a course";
    }

    if (deadlineTime && !deadlineDate) {
      nextErrors.deadline = "Choose a deadline date first";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setError(null);
    setFieldErrors({});
    setIsSaving(true);

    const form = new FormData();
    form.set("title", title.trim());
    form.set("description", description.trim());
    form.set("contentType", "lecturer_assignment");
    form.set("subjectId", subjectId);

    if (deadlineIso) {
      form.set("deadline", deadlineIso);
    }

    for (const file of files) {
      form.append("files", file);
    }

    try {
      const response = await fetch(
        `/api/classes/${selected.slug}/submissions`,
        { method: "POST", body: form },
      );
      const body = (await response.json().catch(() => null)) as {
        data?: { status?: string };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fieldErrors ?? {});
        setError(
          body?.error?.message ??
            "The submission could not be saved. Try again.",
        );
        return;
      }

      toast({
        title:
          body?.data?.status === "published"
            ? "Assignment published"
            : "Publication requested",
        description:
          body?.data?.status === "published"
            ? "The assignment is now visible to class members."
            : "A class admin will review your request before it is published.",
      });
      setOpen(false);
      reset();
    } catch {
      setError("The submission could not be saved. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);

        if (!next) {
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus
            aria-hidden="true"
            className="h-4 w-4"
          />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-[920px] flex-col overflow-hidden p-0 sm:rounded-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
          <span className="bg-accent-soft text-accent mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <FilePlus2
              aria-hidden="true"
              className="h-5 w-5"
            />
          </span>
          <div className="min-w-0">
            <DialogTitle>
              {mode === "create"
                ? "Create Assignment"
                : "Request Task Publication"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Publish a new academic task to your class."
                : "Submit a task for a class admin to review and publish."}
            </DialogDescription>
          </div>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="scroll-thin grid min-h-0 flex-1 gap-6 overflow-y-auto px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            {/* Main form column */}
            <div className="min-w-0 space-y-7">
              {classes.length === 0 ? (
                <Alert variant="info">
                  <p>
                    Join a class first — publication requests are always tied to
                    a class.
                  </p>
                </Alert>
              ) : (
                <>
                  {/* Section 01 */}
                  <section aria-labelledby="ca-section-class">
                    <SectionHeader
                      number={1}
                      id="ca-section-class"
                      heading="Class Information"
                      supporting="Select the class and course for this assignment."
                    />
                    <div className="bg-band mt-4 grid gap-4 rounded-xl p-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="request-class">Class</Label>
                        <Select
                          id="request-class"
                          value={classId}
                          onChange={(event) => pickClass(event.target.value)}
                          className="bg-surface"
                        >
                          {classes.map((item) => (
                            <option
                              key={item.id}
                              value={item.id}
                            >
                              {item.name}
                              {item.class_code ? ` (${item.class_code})` : ""}
                            </option>
                          ))}
                        </Select>
                        <p className="mt-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              selected?.is_admin
                                ? "bg-success-soft text-success"
                                : "bg-accent-soft text-accent"
                            }`}
                          >
                            {selected?.is_admin ? (
                              <CircleCheck
                                aria-hidden="true"
                                className="h-3 w-3"
                              />
                            ) : (
                              <Info
                                aria-hidden="true"
                                className="h-3 w-3"
                              />
                            )}
                            {selected?.is_admin
                              ? "You manage this class"
                              : "You are a member of this class"}
                          </span>
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="request-course">Course</Label>
                        <Select
                          id="request-course"
                          value={subjectId}
                          onChange={(event) => setSubjectId(event.target.value)}
                          aria-invalid={Boolean(fieldErrors.subjectId)}
                          className="bg-surface"
                        >
                          {selected?.subjects.map((subject) => (
                            <option
                              key={subject.id}
                              value={subject.id}
                            >
                              {subject.name}
                              {subject.code ? ` (${subject.code})` : ""}
                            </option>
                          ))}
                        </Select>
                        {fieldErrors.subjectId ? (
                          <p className="text-danger text-xs">
                            {fieldErrors.subjectId}
                          </p>
                        ) : null}
                        {selected && selected.subjects.length === 0 ? (
                          <p className="text-danger text-xs">
                            This class has no courses yet. Ask an admin to add
                            one before submitting.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </section>

                  {/* Section 02 */}
                  <section aria-labelledby="ca-section-details">
                    <SectionHeader
                      number={2}
                      id="ca-section-details"
                      heading="Assignment Details"
                      supporting="Provide the title and description for your assignment."
                    />
                    <div className="mt-4 space-y-4">
                      <div>
                        <Label htmlFor="request-title">
                          Title <span className="text-danger">*</span>
                        </Label>
                        <div className="relative mt-1.5">
                          <Input
                            id="request-title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            maxLength={ASSIGNMENT_TITLE_MAX}
                            placeholder="e.g. Final Project Web Programming"
                            aria-invalid={Boolean(fieldErrors.title)}
                            className="pr-14"
                          />
                          <span
                            aria-hidden="true"
                            className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs tabular-nums"
                          >
                            {title.length}/{ASSIGNMENT_TITLE_MAX}
                          </span>
                        </div>
                        {fieldErrors.title ? (
                          <p className="text-danger mt-1 text-xs">
                            {fieldErrors.title}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <Label htmlFor="request-description">
                          Description <span className="text-danger">*</span>
                        </Label>
                        <Textarea
                          id="request-description"
                          value={description}
                          onChange={(event) =>
                            setDescription(event.target.value)
                          }
                          rows={4}
                          maxLength={DESCRIPTION_MAX}
                          placeholder="Describe the assignment requirements, objectives, and additional instructions…"
                          aria-invalid={Boolean(fieldErrors.description)}
                          className="mt-1.5"
                        />
                        <div className="mt-1 flex items-center justify-between gap-3">
                          {fieldErrors.description ? (
                            <p className="text-danger text-xs">
                              {fieldErrors.description}
                            </p>
                          ) : (
                            <span />
                          )}
                          <span
                            aria-hidden="true"
                            className="text-muted-foreground shrink-0 text-xs tabular-nums"
                          >
                            {description.length}/
                            {DESCRIPTION_MAX.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Section 03 */}
                  <section aria-labelledby="ca-section-schedule">
                    <SectionHeader
                      number={3}
                      id="ca-section-schedule"
                      heading="Schedule & Attachments"
                      supporting="Set the deadline and add supporting files (optional)."
                    />
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="request-deadline-date">
                            Deadline Date
                          </Label>
                          <div className="relative mt-1.5">
                            <CalendarDays
                              aria-hidden="true"
                              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                            />
                            <Input
                              id="request-deadline-date"
                              type="date"
                              value={deadlineDate}
                              onChange={(event) =>
                                setDeadlineDate(event.target.value)
                              }
                              className="pl-9"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="request-deadline-time">
                            Deadline Time
                          </Label>
                          <div className="relative mt-1.5">
                            <Clock
                              aria-hidden="true"
                              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                            />
                            <Input
                              id="request-deadline-time"
                              type="time"
                              value={deadlineTime}
                              onChange={(event) =>
                                setDeadlineTime(event.target.value)
                              }
                              className="pl-9"
                            />
                          </div>
                        </div>
                      </div>
                      {fieldErrors.deadline ? (
                        <p
                          role="alert"
                          className="text-danger text-xs"
                        >
                          {fieldErrors.deadline}
                        </p>
                      ) : null}
                      <div>
                        <Label htmlFor="request-files">
                          Supporting Files{" "}
                          <span className="text-muted-foreground font-normal">
                            (Optional)
                          </span>
                        </Label>
                        <div className="mt-1.5">
                          <FileDropzone
                            files={files}
                            onChange={setFiles}
                          />
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </div>

            {/* Preview sidebar */}
            {classes.length > 0 ? (
              <aside className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
                <AssignmentPreview
                  title={title}
                  courseName={
                    selectedSubject?.name ??
                    (selected?.subjects.length
                      ? "Select a course"
                      : "No course")
                  }
                  className={
                    selected
                      ? `${selected.name}${selected.class_code ? ` (${selected.class_code})` : ""}`
                      : "Select a class"
                  }
                  deadline={deadlineIso}
                  attachmentCount={files.length}
                />
                <AssignmentTips />
                <PublicationPermissionCard managesClass={publishesDirectly} />
              </aside>
            ) : null}
          </div>

          {error ? (
            <div className="shrink-0 px-5 pt-3 sm:px-6">
              <Alert
                variant="error"
                role="alert"
              >
                <p>{error}</p>
              </Alert>
            </div>
          ) : null}

          {/* Sticky footer */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5 sm:px-6">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Info
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0"
              />
              {publishesDirectly
                ? "This assignment will be published directly to the class (as class admin)."
                : "Your assignment will be submitted for administrator review."}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || !subjectId}
              >
                {isSaving ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                    Saving…
                  </>
                ) : publishesDirectly ? (
                  <>
                    <Send
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                    Publish Assignment
                  </>
                ) : (
                  <>
                    <Send
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                    Request Publication
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeader({
  number,
  id,
  heading,
  supporting,
}: {
  number: number;
  id: string;
  heading: string;
  supporting: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="bg-accent text-accent-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums"
      >
        {number}
      </span>
      <div>
        <h3
          id={id}
          className="text-foreground text-base font-semibold tracking-tight"
        >
          {heading}
        </h3>
        <p className="text-muted-foreground mt-0.5 text-sm">{supporting}</p>
      </div>
    </div>
  );
}

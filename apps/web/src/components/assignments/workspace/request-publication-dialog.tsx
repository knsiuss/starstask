"use client";

import { FilePlus2, Info, Loader2, Plus, Send } from "lucide-react";

import {
  AssignmentPreview,
  AssignmentTips,
  PublicationPermissionCard,
} from "@/components/assignments/workspace/assignment-preview";
import { RequestPublicationFields } from "@/components/assignments/workspace/request-publication-fields";
import { useRequestPublicationForm } from "@/components/assignments/workspace/use-request-publication-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { WorkspaceClassOption } from "@/lib/db/assignment-workspace";

type Props = {
  classes: WorkspaceClassOption[];
  /** Admins create assignments; students request publication. */
  mode: "create" | "request";
};

/**
 * Class assignment submission dialog.
 *
 * One component serves both roles: for a class the member administers, the
 * existing submissions route publishes immediately; anywhere else the row is
 * stored as `pending_review` and a class admin reviews it.
 */
export function RequestPublicationDialog({ classes, mode }: Props) {
  const form = useRequestPublicationForm(classes);
  const triggerLabel =
    mode === "create" ? "Create Assignment" : "Request Task Publication";

  return (
    <Dialog
      open={form.open}
      onOpenChange={(next) => {
        form.setOpen(next);

        if (!next) {
          form.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="min-h-[44px] w-full sm:min-h-10 sm:w-auto">
          <Plus
            aria-hidden="true"
            className="h-4 w-4"
          />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-[920px] flex-col overflow-hidden rounded-xl p-0 sm:w-[calc(100%-2rem)] sm:rounded-2xl">
        <div className="border-border flex shrink-0 items-start gap-3 border-b px-4 py-3.5 pr-12 sm:px-6 sm:py-4">
          <span className="bg-accent-soft text-accent mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11">
            <FilePlus2
              aria-hidden="true"
              className="h-5 w-5"
            />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-base sm:text-lg">
              {mode === "create"
                ? "Create Assignment"
                : "Request Task Publication"}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {mode === "create"
                ? "Publish a new academic task to your class."
                : "Submit a task for a class admin to review and publish."}
            </DialogDescription>
          </div>
        </div>

        <form
          onSubmit={form.submit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="scroll-thin grid min-h-0 flex-1 gap-6 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-7">
              {classes.length === 0 ? (
                <Alert variant="info">
                  <p>
                    Join a class first. Publication requests are always tied to
                    a class.
                  </p>
                </Alert>
              ) : (
                <RequestPublicationFields
                  classes={classes}
                  selected={form.selected}
                  classId={form.classId}
                  subjectId={form.subjectId}
                  title={form.title}
                  description={form.description}
                  deadlineDate={form.deadlineDate}
                  deadlineTime={form.deadlineTime}
                  files={form.files}
                  fieldErrors={form.fieldErrors}
                  onClassChange={form.pickClass}
                  onSubjectChange={form.setSubjectId}
                  onTitleChange={form.setTitle}
                  onDescriptionChange={form.setDescription}
                  onDeadlineDateChange={form.setDeadlineDate}
                  onDeadlineTimeChange={form.setDeadlineTime}
                  onFilesChange={form.setFiles}
                />
              )}
            </div>

            {classes.length > 0 ? (
              <aside className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
                <AssignmentPreview
                  title={form.title}
                  courseName={
                    form.selectedSubject?.name ??
                    (form.selected?.subjects.length
                      ? "Select a course"
                      : "No course")
                  }
                  className={
                    form.selected
                      ? `${form.selected.name}${form.selected.class_code ? ` (${form.selected.class_code})` : ""}`
                      : "Select a class"
                  }
                  deadline={form.deadlineIso}
                  attachmentCount={form.files.length}
                />
                <AssignmentTips />
                <PublicationPermissionCard
                  managesClass={form.publishesDirectly}
                />
              </aside>
            ) : null}
          </div>

          {form.error ? (
            <div className="shrink-0 px-4 pt-3 sm:px-6">
              <Alert
                variant="error"
                role="alert"
              >
                <p>{form.error}</p>
              </Alert>
            </div>
          ) : null}

          <div className="border-border flex shrink-0 flex-col gap-3 border-t px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Info
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0"
              />
              {form.publishesDirectly
                ? "This assignment will be published directly to the class (as class admin)."
                : "Your assignment will be submitted for administrator review."}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="secondary"
                onClick={() => form.setOpen(false)}
                disabled={form.isSaving}
                className="min-h-[44px] w-full sm:min-h-10 sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.isSaving || !form.subjectId}
                className="min-h-[44px] w-full sm:min-h-10 sm:w-auto"
              >
                {form.isSaving ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                    Saving...
                  </>
                ) : form.publishesDirectly ? (
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

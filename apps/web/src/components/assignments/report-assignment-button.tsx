"use client";

import { Flag, Loader2 } from "lucide-react";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ASSIGNMENT_REPORT_REASONS,
  ASSIGNMENT_REPORT_REASON_LABELS,
  ASSIGNMENT_REPORT_NOTE_MAX,
  type AssignmentReportReason,
} from "@starstask/contracts";

type ReportAssignmentButtonProps = {
  assignmentId: string;
};

/**
 * "Something is wrong" entry point for a published assignment.
 *
 * Reporting is advisory: it files a row for a reviewer and never edits the
 * brief itself, so a wrong report cannot damage the archive.
 */
export function ReportAssignmentButton({
  assignmentId,
}: ReportAssignmentButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] =
    React.useState<AssignmentReportReason>("wrong_deadline");
  const [note, setNote] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isFiled, setIsFiled] = React.useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setError(null);
      setIsFiled(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/assignments/${assignmentId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          note: note.trim() === "" ? undefined : note.trim(),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not send the report.");
        return;
      }

      setIsFiled(true);
      setNote("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
        >
          <Flag
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Report a problem
        </Button>
      </DialogTrigger>
      <DialogContent>
        {isFiled ? (
          <>
            <DialogTitle>Report sent</DialogTitle>
            <DialogDescription>
              A class admin will check it against the original brief. You will
              not get a reply here; the assignment page is updated if the brief
              changes.
            </DialogDescription>
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={() => handleOpenChange(false)}
              >
                Done
              </Button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogTitle>Report a problem</DialogTitle>
            <DialogDescription>
              Tell us what is wrong with the brief. Reports are visible to the
              class admin and platform admins, not to other students.
            </DialogDescription>

            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="report-reason">What is wrong?</Label>
                <Select
                  id="report-reason"
                  value={reason}
                  onChange={(event) =>
                    setReason(event.target.value as AssignmentReportReason)
                  }
                  disabled={isSubmitting}
                >
                  {ASSIGNMENT_REPORT_REASONS.map((value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {ASSIGNMENT_REPORT_REASON_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="report-note">Details (optional)</Label>
                <Textarea
                  id="report-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={ASSIGNMENT_REPORT_NOTE_MAX}
                  rows={4}
                  placeholder="Example: the deadline says 23:59 but the lecturer announced 12:00."
                  disabled={isSubmitting}
                />
                <p className="text-muted-foreground text-xs">
                  {note.trim().length === 0
                    ? "At least five characters when you add a note."
                    : `${note.trim().length} characters`}
                </p>
              </div>
            </div>

            {error ? (
              <Alert
                variant="error"
                className="mt-4"
              >
                {error}
              </Alert>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                    Sending...
                  </>
                ) : (
                  "Send report"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

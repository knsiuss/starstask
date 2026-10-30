"use client";

import { Check, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { AssignmentReport } from "@/lib/db/assignment-trust";
import {
  ASSIGNMENT_REPORT_NOTE_MAX,
  ASSIGNMENT_REPORT_REASON_LABELS,
  type AssignmentReportReviewStatus,
} from "@starstask/contracts";
import { formatDeadline } from "@starstask/shared";

type AssignmentReportCardProps = {
  report: AssignmentReport;
};

/**
 * One row in the report queue. Resolving and dismissing use the same form so
 * the reviewer always leaves a reason the next reviewer can read.
 */
export function AssignmentReportCard({ report }: AssignmentReportCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [note, setNote] = React.useState("");
  const [pending, setPending] =
    React.useState<AssignmentReportReviewStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (status: AssignmentReportReviewStatus) => {
    if (pending) {
      return;
    }

    setPending(status);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/assignment-reports/${report.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            note: note.trim() === "" ? undefined : note.trim(),
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not update the report.");
        return;
      }

      toast({
        variant: "success",
        title: status === "resolved" ? "Report resolved" : "Report dismissed",
      });
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(null);
    }
  };

  return (
    <article className="border-border bg-surface rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">
            {report.className} ·{" "}
            {ASSIGNMENT_REPORT_REASON_LABELS[report.reason]}
          </p>
          <h3 className="mt-1 truncate text-sm font-semibold">
            <Link
              href={`/assignments/${report.assignmentId}`}
              className="hover:text-accent hover:underline"
            >
              {report.assignmentTitle}
            </Link>
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Reported by {report.reporterName} ·{" "}
            {formatDeadline(report.createdAt)}
          </p>
        </div>

        <span className="bg-warning-soft text-warning rounded-full px-2.5 py-0.5 text-[11px] font-medium">
          Open
        </span>
      </div>

      {report.note ? (
        <p className="text-foreground border-border mt-3 border-l-2 pl-3 text-sm leading-relaxed whitespace-pre-line">
          {report.note}
        </p>
      ) : (
        <p className="text-muted-foreground mt-3 text-sm">
          No details were provided.
        </p>
      )}

      <div className="mt-4 space-y-1.5">
        <Label htmlFor={`resolution-${report.id}`}>
          Resolution note (optional)
        </Label>
        <Textarea
          id={`resolution-${report.id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={ASSIGNMENT_REPORT_NOTE_MAX}
          rows={2}
          placeholder="Example: corrected the deadline to 12:00 after checking the lecturer's announcement."
          disabled={pending !== null}
        />
      </div>

      {error ? (
        <Alert
          variant="error"
          className="mt-3"
        >
          {error}
        </Alert>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => submit("dismissed")}
          disabled={pending !== null}
        >
          {pending === "dismissed" ? (
            <Loader2
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin"
            />
          ) : (
            <X
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          )}
          Dismiss
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => submit("resolved")}
          disabled={pending !== null}
        >
          {pending === "resolved" ? (
            <Loader2
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin"
            />
          ) : (
            <Check
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          )}
          Mark resolved
        </Button>
      </div>
    </article>
  );
}

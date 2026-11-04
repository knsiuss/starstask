"use client";

import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { REVISION_REQUEST_PREFIX } from "@/lib/assignments/workspace";

type Props = {
  assignmentId: string;
  classSlug: string;
  title: string;
};

type Decision = "approved" | "rejected" | "revision";

/**
 * Class-admin review dialog for one publication request.
 *
 * Approval publishes the assignment (the route requires `confirmPublic`), and
 * both rejection paths require a reason. A revision request is a rejection
 * carrying the revision marker so the student's list can label it correctly
 * and the revise flow can send it back to the queue.
 */
export function ReviewRequestDialog({ assignmentId, classSlug, title }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [isSaving, setIsSaving] = React.useState<Decision | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const decide = async (decision: Decision) => {
    if (isSaving) {
      return;
    }

    if (decision !== "approved" && reason.trim().length < 3) {
      setError("Give the student a short note (at least 3 characters).");
      return;
    }

    setError(null);
    setIsSaving(decision);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/submissions/${assignmentId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: decision === "approved" ? "approved" : "rejected",
            reason:
              decision === "revision"
                ? `${REVISION_REQUEST_PREFIX} ${reason.trim()}`
                : decision === "rejected"
                  ? reason.trim()
                  : undefined,
            confirmPublic: decision === "approved",
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(
          body?.error?.message ?? "The decision could not be saved. Try again.",
        );
        return;
      }

      toast({
        title:
          decision === "approved"
            ? "Assignment published"
            : decision === "revision"
              ? "Revision requested"
              : "Request rejected",
        description:
          decision === "approved"
            ? "The assignment is now visible to class members."
            : "The student has been notified with your feedback.",
      });
      setOpen(false);
      setReason("");
    } catch {
      setError("The decision could not be saved. Try again.");
    } finally {
      setIsSaving(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
        >
          Review
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Review request</DialogTitle>
        <DialogDescription>
          {title}. Approving publishes it to every member of the class.
        </DialogDescription>

        <div className="mt-4 space-y-1.5">
          <Label htmlFor={`review-reason-${assignmentId}`}>
            Feedback for the student
          </Label>
          <Textarea
            id={`review-reason-${assignmentId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Required for reject and revision requests"
          />
        </div>

        {error ? (
          <Alert
            variant="error"
            role="alert"
            className="mt-3"
          >
            <p>{error}</p>
          </Alert>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            variant="danger"
            size="sm"
            disabled={isSaving !== null}
            onClick={() => decide("rejected")}
          >
            {isSaving === "rejected" ? (
              <Loader2
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin"
              />
            ) : null}
            Reject
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isSaving !== null}
            onClick={() => decide("revision")}
          >
            {isSaving === "revision" ? (
              <Loader2
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin"
              />
            ) : null}
            Request revision
          </Button>
          <Button
            size="sm"
            disabled={isSaving !== null}
            onClick={() => decide("approved")}
          >
            {isSaving === "approved" ? (
              <Loader2
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin"
              />
            ) : null}
            Approve and publish
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

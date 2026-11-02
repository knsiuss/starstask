"use client";

import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LEAVE_REVIEW_NOTE_MAX,
  type LeaveReviewDecision,
} from "@starstask/contracts";

type LeaveReviewActionsProps = {
  requestId: string;
  classSlug: string;
};

/**
 * Approve or reject one submitted absence.
 *
 * Approval is an academic decision that also marks the covered sessions
 * excused. It never marks the student present, and the student is told either
 * way. The note is optional and stays in the request history.
 */
export function LeaveReviewActions({
  requestId,
  classSlug,
}: LeaveReviewActionsProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<LeaveReviewDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: LeaveReviewDecision) {
    setPending(decision);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/leave-requests/${requestId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, note }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message: string };
        } | null;

        setError(body?.error?.message ?? "Could not record the decision.");
        return;
      }

      setNote("");
      router.refresh();
    } catch {
      setError("Could not record the decision. Try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-3">
      {error ? (
        <Alert variant="error">
          <p className="font-medium">{error}</p>
        </Alert>
      ) : null}

      <div>
        <Label htmlFor="reviewNote">
          Note{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="reviewNote"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={LEAVE_REVIEW_NOTE_MAX}
          className="mt-1"
          placeholder="Anything the student should know about this decision."
          disabled={pending !== null}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending !== null}
          onClick={() => void decide("approved")}
        >
          {pending === "approved" ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <Check
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
          Approve absence
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending !== null}
          onClick={() => void decide("rejected")}
        >
          {pending === "rejected" ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <X
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
          Reject
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Approving marks the sessions covered by these dates as excused. It never
        marks the student present. The student is notified either way.
      </p>
    </div>
  );
}

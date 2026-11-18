"use client";

import { CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

type LecturerOutcome = "approved" | "rejected" | "awaiting";

type LecturerOutcomeActionsProps = {
  classSlug: string;
  requestId: string;
};

/**
 * Allows a lecturer or class manager to record the final lecturer outcome
 * (`approved`, `rejected`, `awaiting`) on a forwarded absence request.
 */
export function LecturerOutcomeActions({
  classSlug,
  requestId,
}: LecturerOutcomeActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState<LecturerOutcome | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const submitOutcome = async (outcome: LecturerOutcome) => {
    if (pending) {
      return;
    }

    setPending(outcome);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/leave-requests/${requestId}/outcome`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outcome,
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(
          payload?.error?.message ?? "Could not record lecturer outcome.",
        );
        return;
      }

      toast({
        variant: "success",
        title: "Lecturer decision recorded",
      });
      setNote("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-3">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="space-y-1.5">
        <Label htmlFor={`lecturer-outcome-note-${requestId}`}>
          Lecturer note (optional)
        </Label>
        <Textarea
          id={`lecturer-outcome-note-${requestId}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note about the lecturer's decision"
          rows={2}
          maxLength={2000}
          disabled={pending !== null}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => void submitOutcome("approved")}
          disabled={pending !== null}
        >
          {pending === "approved" ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <CheckCircle2
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
          Approve (excuse)
        </Button>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void submitOutcome("awaiting")}
          disabled={pending !== null}
        >
          {pending === "awaiting" ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <Clock3
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
          Mark awaiting
        </Button>

        <Button
          type="button"
          size="sm"
          variant="danger"
          onClick={() => void submitOutcome("rejected")}
          disabled={pending !== null}
        >
          {pending === "rejected" ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <XCircle
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
          Reject
        </Button>
      </div>
    </div>
  );
}

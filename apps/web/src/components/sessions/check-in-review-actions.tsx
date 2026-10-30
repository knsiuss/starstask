"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  SESSION_CHECKIN_STATUSES,
  SESSION_CHECKIN_STATUS_LABELS,
  type SessionCheckInStatus,
} from "@starstask/contracts";

type CheckInReviewActionsProps = {
  sessionId: string;
  checkInId: string;
  displayName: string;
  initialStatus: SessionCheckInStatus;
};

/**
 * Organizer override for one attendance row.
 *
 * Nothing changes until Save is pressed, so a stray tap on the select cannot
 * quietly mark somebody absent.
 */
export function CheckInReviewActions({
  sessionId,
  checkInId,
  displayName,
  initialStatus,
}: CheckInReviewActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] =
    React.useState<SessionCheckInStatus>(initialStatus);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    if (isSaving || status === initialStatus) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/checkins/${checkInId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setStatus(initialStatus);
        setError(body?.error?.message ?? "Could not update this row.");
        return;
      }

      toast({
        variant: "success",
        title: `${displayName} marked ${SESSION_CHECKIN_STATUS_LABELS[status].toLowerCase()}`,
      });
      router.refresh();
    } catch {
      setStatus(initialStatus);
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <label
          htmlFor={`checkin-status-${checkInId}`}
          className="sr-only"
        >
          Attendance status for {displayName}
        </label>
        <select
          id={`checkin-status-${checkInId}`}
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as SessionCheckInStatus)
          }
          disabled={isSaving}
          className="border-border bg-surface focus-visible:outline-accent rounded-md border px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {SESSION_CHECKIN_STATUSES.map((option) => (
            <option
              key={option}
              value={option}
            >
              {SESSION_CHECKIN_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void save()}
          disabled={isSaving || status === initialStatus}
          aria-busy={isSaving}
        >
          {isSaving ? (
            <Loader2
              aria-hidden="true"
              className="h-3 w-3 animate-spin"
            />
          ) : null}
          Save
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="text-danger text-[11px]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

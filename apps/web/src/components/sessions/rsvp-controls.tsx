"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  RSVP_STATUSES,
  RSVP_STATUS_LABELS,
  type RsvpStatus,
} from "@starstask/contracts";

type RsvpCounts = {
  goingCount: number;
  maybeCount: number;
  capacity: number | null;
};

type RsvpControlsProps = {
  sessionId: string;
  initialStatus: RsvpStatus | null;
  initialCounts: RsvpCounts;
  /** False once the session is cancelled, started, or registration closed. */
  canRespond: boolean;
  closedReason?: string | null;
};

/**
 * RSVP buttons.
 *
 * The selection is optimistic so the chosen state appears immediately, but the
 * counts stay server-authoritative: a capacity or window rejection reverts the
 * selection and shows the real error instead of an optimistic lie.
 */
export function RsvpControls({
  sessionId,
  initialStatus,
  initialCounts,
  canRespond,
  closedReason,
}: RsvpControlsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = React.useState<RsvpStatus | null>(initialStatus);
  const [counts, setCounts] = React.useState<RsvpCounts>(initialCounts);
  const [pending, setPending] = React.useState<RsvpStatus | "cancel" | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (next: RsvpStatus | null) => {
    if (pending) {
      return;
    }

    const previousStatus = status;
    const previousCounts = counts;

    setError(null);
    setPending(next ?? "cancel");
    setStatus(next);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/rsvp`, {
        method: next ? "PUT" : "DELETE",
        headers: next ? { "Content-Type": "application/json" } : undefined,
        body: next ? JSON.stringify({ status: next }) : undefined,
      });

      const body = (await response.json().catch(() => null)) as {
        data?: {
          attendance?: RsvpCounts & { status?: RsvpStatus };
          removed?: boolean;
        };
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setStatus(previousStatus);
        setCounts(previousCounts);
        setError(body?.error?.message ?? "Could not save your RSVP.");
        return;
      }

      if (next) {
        setStatus(body?.data?.attendance?.status ?? next);
        setCounts({
          goingCount: body?.data?.attendance?.goingCount ?? counts.goingCount,
          maybeCount: body?.data?.attendance?.maybeCount ?? counts.maybeCount,
          capacity: body?.data?.attendance?.capacity ?? counts.capacity,
        });
        toast({
          variant: "success",
          title: `RSVP saved: ${RSVP_STATUS_LABELS[next].toLowerCase()}`,
        });
      } else {
        setStatus(null);
        toast({ variant: "info", title: "Your RSVP was removed" });
      }

      router.refresh();
    } catch {
      setStatus(previousStatus);
      setCounts(previousCounts);
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  };

  const spotsLeft =
    counts.capacity === null
      ? null
      : Math.max(counts.capacity - counts.goingCount, 0);

  return (
    <section
      aria-labelledby="rsvp-heading"
      className="border-border bg-surface rounded-xl border p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="rsvp-heading"
          className="text-base font-semibold"
        >
          Your RSVP
        </h2>
        <p className="text-muted-foreground text-xs">
          {counts.goingCount} going
          {counts.maybeCount > 0 ? ` · ${counts.maybeCount} maybe` : ""}
          {spotsLeft !== null ? ` · ${spotsLeft} spots left` : ""}
        </p>
      </div>

      {error ? (
        <Alert
          variant="error"
          className="mt-3"
        >
          {error}
        </Alert>
      ) : null}

      {!canRespond ? (
        <p className="text-muted-foreground mt-3 text-sm">
          {closedReason ?? "Registration for this session is closed."}
        </p>
      ) : (
        <>
          <div
            role="group"
            aria-label="Choose your RSVP"
            className="mt-3 flex flex-wrap gap-2"
          >
            {RSVP_STATUSES.map((option) => {
              const isActive = status === option;

              return (
                <Button
                  key={option}
                  type="button"
                  variant={isActive ? "primary" : "secondary"}
                  aria-pressed={isActive}
                  disabled={pending !== null}
                  onClick={() => void submit(option)}
                >
                  {pending === option ? (
                    <Loader2
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                  ) : null}
                  {RSVP_STATUS_LABELS[option]}
                </Button>
              );
            })}
          </div>

          {status ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              disabled={pending !== null}
              onClick={() => void submit(null)}
            >
              Cancel my RSVP
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}

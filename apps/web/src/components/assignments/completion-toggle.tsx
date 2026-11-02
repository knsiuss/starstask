"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { cn } from "@/lib/utils/cn";

type CompletionToggleProps = {
  assignmentId: string;
  completed: boolean;
  /** A short title, used to build the accessible label. */
  title: string;
};

/**
 * Marks an assignment done for the caller's own tracking.
 *
 * This is personal bookkeeping, not a submission: the copy and the accessible
 * label both avoid words like "submit" or "hand in" so a student can never
 * mistake a tick for handing work to a lecturer.
 */
export function CompletionToggle({
  assignmentId,
  completed: initialCompleted,
  title,
}: CompletionToggleProps) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !completed;

    startTransition(async () => {
      setFailed(false);

      try {
        const response = await fetch(
          `/api/assignments/${assignmentId}/completion`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed: next }),
          },
        );

        if (!response.ok) {
          setFailed(true);
          return;
        }

        setCompleted(next);
      } catch {
        setFailed(true);
      }
    });
  }

  const label = completed
    ? `Remove your "done" mark from ${title}`
    : `Mark ${title} as done for yourself`;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={completed}
      aria-label={label}
      title={
        completed ? "Done — click to clear" : "Mark as done (only you see this)"
      }
      className={cn(
        "focus-visible:outline-accent inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60",
        completed
          ? "border-success/40 bg-success-soft text-success"
          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
        failed && "border-danger/50 text-danger",
      )}
    >
      {isPending ? (
        <Loader2
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin"
        />
      ) : completed ? (
        <Check
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
      ) : (
        <Circle
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
      )}
    </button>
  );
}

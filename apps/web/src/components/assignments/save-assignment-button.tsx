"use client";

import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";

type SaveAssignmentButtonProps = {
  assignmentId: string;
  initialSaved: boolean;
};

/**
 * Saves or unsaves an assignment so its deadline is included in reminders.
 *
 * Only rendered for signed-in users on published assignments; the API and RLS
 * enforce the same rule if this component is bypassed.
 */
export function SaveAssignmentButton({
  assignmentId,
  initialSaved,
}: SaveAssignmentButtonProps) {
  const [isSaved, setIsSaved] = React.useState(initialSaved);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggle = async () => {
    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch(
        isSaved
          ? `/api/saved-assignments/${assignmentId}`
          : "/api/saved-assignments",
        {
          method: isSaved ? "DELETE" : "POST",
          headers: isSaved ? undefined : { "Content-Type": "application/json" },
          body: isSaved ? undefined : JSON.stringify({ assignmentId }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not update this assignment.");
        return;
      }

      setIsSaved((current) => !current);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => void toggle()}
        disabled={isBusy}
        aria-busy={isBusy}
      >
        {isBusy ? (
          <Loader2
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin"
          />
        ) : isSaved ? (
          <BookmarkCheck
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        ) : (
          <Bookmark
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        )}
        {isSaved ? "Saved for reminders" : "Save for reminders"}
      </Button>
      {error ? <p className="text-danger mt-1 text-xs">{error}</p> : null}
    </div>
  );
}

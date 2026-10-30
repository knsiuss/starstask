"use client";

import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type SaveAssignmentButtonProps = {
  assignmentId: string;
  initialSaved: boolean;
};

/**
 * Saves or unsaves an assignment so its deadline is included in reminders.
 *
 * The toggle is optimistic: the label flips immediately and reverts if the API
 * rejects the change, so a slow network never makes the button feel dead. Only
 * rendered for signed-in users on published assignments; the API and RLS
 * enforce the same rule if this component is bypassed.
 */
export function SaveAssignmentButton({
  assignmentId,
  initialSaved,
}: SaveAssignmentButtonProps) {
  const { toast } = useToast();
  const [isSaved, setIsSaved] = React.useState(initialSaved);
  const [isBusy, setIsBusy] = React.useState(false);

  const toggle = async () => {
    if (isBusy) {
      return;
    }

    const nextSaved = !isSaved;

    setIsBusy(true);
    setIsSaved(nextSaved);

    try {
      const response = await fetch(
        nextSaved
          ? "/api/saved-assignments"
          : `/api/saved-assignments/${assignmentId}`,
        {
          method: nextSaved ? "POST" : "DELETE",
          headers: nextSaved
            ? { "Content-Type": "application/json" }
            : undefined,
          body: nextSaved ? JSON.stringify({ assignmentId }) : undefined,
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;

        setIsSaved(!nextSaved);
        toast({
          variant: "error",
          title: "Could not update this assignment",
          description: body?.error?.message ?? "Please try again in a moment.",
        });

        return;
      }

      toast({
        variant: "success",
        title: nextSaved ? "Saved for reminders" : "Removed from reminders",
        description: nextSaved
          ? "You will get a reminder before the deadline."
          : undefined,
      });
    } catch {
      setIsSaved(!nextSaved);
      toast({
        variant: "error",
        title: "Network error",
        description: "Check your connection and try again.",
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => void toggle()}
      disabled={isBusy}
      aria-busy={isBusy}
      aria-pressed={isSaved}
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
  );
}

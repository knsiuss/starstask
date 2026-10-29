"use client";

import { BookmarkX, Loader2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SavedAssignmentSummary } from "@/lib/db/push";
import { formatDeadline } from "@starstask/shared";

type SavedAssignmentListProps = {
  saved: SavedAssignmentSummary[];
  onRemoved: (saved: SavedAssignmentSummary[]) => void;
};

export function SavedAssignmentList({
  saved,
  onRemoved,
}: SavedAssignmentListProps) {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const remove = async (assignmentId: string) => {
    setBusyId(assignmentId);
    setError(null);

    try {
      const response = await fetch(`/api/saved-assignments/${assignmentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(
          body?.error?.message ?? "Could not remove this saved assignment.",
        );
        return;
      }

      onRemoved(saved.filter((item) => item.assignment_id !== assignmentId));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <h2 className="text-base font-semibold">Saved assignments</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        You receive reminders for assignments you save here, even when you are
        not the author. Saving never changes the public assignment.
      </p>

      {error ? (
        <Alert
          variant="error"
          className="mt-4"
        >
          {error}
        </Alert>
      ) : null}

      {saved.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          Nothing saved yet. Open an assignment and choose Save for reminders.
        </p>
      ) : (
        <ul className="divide-border border-border mt-4 divide-y rounded-md border">
          {saved.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <Link
                    href={`/assignments/${item.assignment_id}`}
                    className="hover:text-accent hover:underline"
                  >
                    {item.title}
                  </Link>
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {item.course_name}
                  {item.deadline
                    ? ` · Due ${formatDeadline(item.deadline)}`
                    : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busyId === item.assignment_id}
                aria-busy={busyId === item.assignment_id}
                onClick={() => void remove(item.assignment_id)}
              >
                {busyId === item.assignment_id ? (
                  <Loader2
                    aria-hidden="true"
                    className="h-3.5 w-3.5 animate-spin"
                  />
                ) : (
                  <BookmarkX
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                )}
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

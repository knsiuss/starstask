"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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

type DeleteSubjectButtonProps = {
  classSlug: string;
  subjectId: string;
  subjectName: string;
};

/**
 * Removes a subject from the class after confirmation.
 *
 * Assignments keep existing without a subject; the subject's weekly schedule
 * rows are deleted with it. There is no undo.
 */
export function DeleteSubjectButton({
  classSlug,
  subjectId,
  subjectName,
}: DeleteSubjectButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/subjects/${subjectId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not delete the subject.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);

        if (!next) {
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Delete subject ${subjectName}`}
          className="text-muted-foreground hover:text-danger hover:bg-danger/10 rounded p-1 transition-colors"
        >
          <Trash2
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete {subjectName}?</DialogTitle>
        <DialogDescription>
          This cannot be undone. The subject is removed from the class and its
          weekly schedule entries are deleted with it. Existing assignments
          remain published without a subject.
        </DialogDescription>

        {error ? (
          <Alert
            variant="error"
            className="mt-4"
          >
            {error}
          </Alert>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => void handleDelete()}
            disabled={isBusy}
          >
            {isBusy ? (
              <Loader2
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin"
              />
            ) : null}
            Delete subject
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

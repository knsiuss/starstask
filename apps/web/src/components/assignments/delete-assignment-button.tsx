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

type DeleteAssignmentButtonProps = {
  assignmentId: string;
  title: string;
  variant?: "inline" | "full";
};

export function DeleteAssignmentButton({
  assignmentId,
  title,
  variant = "inline",
}: DeleteAssignmentButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not delete the assignment.");
        return;
      }

      setOpen(false);
      router.push("/my-assignments");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button
          variant="danger"
          size={variant === "inline" ? "sm" : "md"}
        >
          <Trash2
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete this assignment?</DialogTitle>
        <DialogDescription>
          “{title}” and its attachments will be permanently removed. This cannot
          be undone.
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
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-busy={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
                Deleting...
              </>
            ) : (
              "Delete permanently"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

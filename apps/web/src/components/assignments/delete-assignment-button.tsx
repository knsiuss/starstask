"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  cancelScheduledDelete,
  scheduleDelete,
} from "@/lib/utils/delayed-delete";

/** Long enough to read the toast and change your mind. */
const UNDO_WINDOW_MS = 6_000;

type DeleteAssignmentButtonProps = {
  assignmentId: string;
  title: string;
  variant?: "inline" | "full";
};

/**
 * Deletes an assignment after a short undo window.
 *
 * The request is not sent until the window closes, so "Undo" is real and not a
 * cosmetic message. Leaving the page flushes the request with `keepalive`, so
 * navigating away cannot silently keep a deleted assignment alive.
 */
export function DeleteAssignmentButton({
  assignmentId,
  title,
  variant = "inline",
}: DeleteAssignmentButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [isScheduled, setIsScheduled] = React.useState(false);
  const isMounted = React.useRef(true);
  const undoKey = `assignment-delete:${assignmentId}`;

  React.useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleDelete = () => {
    if (isScheduled) {
      return;
    }

    setOpen(false);
    setIsScheduled(true);

    toast({
      variant: "info",
      title: "Assignment deleted",
      description: "Removing it in a few seconds. You can still undo.",
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          if (!cancelScheduledDelete(undoKey)) {
            return;
          }

          if (isMounted.current) {
            setIsScheduled(false);
          }

          toast({ variant: "success", title: "Assignment restored" });
        },
      },
    });

    scheduleDelete(
      undoKey,
      () => {
        void fetch(`/api/assignments/${assignmentId}`, {
          method: "DELETE",
          // Lets a pagehide flush finish even if the tab closes immediately.
          keepalive: true,
        })
          .then((response) => {
            if (!response.ok) {
              console.error(
                "Deferred assignment delete failed",
                response.status,
              );
              return;
            }

            if (isMounted.current) {
              router.push("/assignments");
              router.refresh();
            }
          })
          .catch(() => {
            console.error("Deferred assignment delete failed");
          });
      },
      UNDO_WINDOW_MS,
    );
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
          disabled={isScheduled}
          className={
            variant === "inline"
              ? "min-h-[44px] px-4 sm:min-h-8 sm:px-3"
              : "min-h-[44px] w-full sm:w-auto"
          }
        >
          {isScheduled ? (
            <Loader2
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin"
            />
          ) : (
            <Trash2
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          )}
          {isScheduled ? "Deleting..." : "Delete"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete this assignment?</DialogTitle>
        <DialogDescription>
          “{title}” and its attachments will be removed permanently. You get a
          few seconds to undo after confirming.
        </DialogDescription>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
            className="min-h-[44px] w-full sm:min-h-10 sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            className="min-h-[44px] w-full sm:min-h-10 sm:w-auto"
          >
            Delete assignment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

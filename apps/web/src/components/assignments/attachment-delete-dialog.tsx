"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import type { AttachmentView } from "@/components/assignments/attachment-list";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type AttachmentDeleteDialogProps = {
  assignmentId: string;
  attachment: AttachmentView;
  onClose: () => void;
};

export function AttachmentDeleteDialog({
  assignmentId,
  attachment,
  onClose,
}: AttachmentDeleteDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const remove = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/assignments/${assignmentId}/attachments/${attachment.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not delete the attachment.");
        return;
      }

      toast({
        variant: "success",
        title: "Attachment deleted",
        description: `${attachment.originalFilename} was removed.`,
      });
      onClose();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isDeleting) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogTitle>Delete this attachment?</DialogTitle>
        <DialogDescription>
          {attachment.originalFilename} will be removed from this assignment and
          cannot be restored.
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
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => void remove()}
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
              <>
                <Trash2
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Delete attachment
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

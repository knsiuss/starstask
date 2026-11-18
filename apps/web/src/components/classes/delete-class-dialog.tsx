"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

type DeleteClassDialogProps = {
  classSlug: string;
  classLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Confirmation dialog for permanently deleting a class via `DELETE /api/classes/[slug]`.
 */
export function DeleteClassDialog({
  classSlug,
  classLabel,
  open,
  onOpenChange,
}: DeleteClassDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    if (!confirmText.trim()) {
      setError("Type the class name or code to confirm deletion.");
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/classes/${classSlug}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmText.trim() }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(
          body?.error?.message ??
            "Could not delete this class. Archive it instead if it has academic history.",
        );
        return;
      }

      toast({
        variant: "success",
        title: `Deleted ${classLabel ?? classSlug}`,
      });
      onOpenChange(false);
      router.push("/classes");
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
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogTitle>Delete {classLabel ?? "this class"}?</DialogTitle>
        <DialogDescription>
          This permanently deletes the class. If the class already has
          assignments, attendance, or academic records, archive it instead.
        </DialogDescription>

        {error ? (
          <Alert
            variant="error"
            className="mt-3"
          >
            {error}
          </Alert>
        ) : null}

        <div className="mt-4 space-y-1.5">
          <Label htmlFor={`delete-confirm-${classSlug}`}>
            Type <span className="font-mono">{classLabel ?? classSlug}</span> to
            confirm
          </Label>
          <Input
            id={`delete-confirm-${classSlug}`}
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={classLabel ?? classSlug}
            disabled={isDeleting}
          />
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : null}
            Confirm delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

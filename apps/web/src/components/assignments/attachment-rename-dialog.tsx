"use client";

import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import {
  ATTACHMENT_FILENAME_MAX,
  attachmentRenameSchema,
} from "@starstask/contracts";

type AttachmentRenameDialogProps = {
  assignmentId: string;
  attachment: AttachmentView;
  onClose: () => void;
};

export function AttachmentRenameDialog({
  assignmentId,
  attachment,
  onClose,
}: AttachmentRenameDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState(() =>
    fileStem(attachment.originalFilename),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const extension = fileExtension(attachment.originalFilename);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const filename = `${name.trim()}${extension}`;
    const parsed = attachmentRenameSchema.safeParse({ filename });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the file name.");
      return;
    }

    if (filename === attachment.originalFilename) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/assignments/${assignmentId}/attachments/${attachment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: parsed.data.filename }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string; fieldErrors?: { filename?: string } };
        } | null;
        setError(
          body?.error?.fieldErrors?.filename ??
            body?.error?.message ??
            "Could not rename the attachment.",
        );
        return;
      }

      toast({
        variant: "success",
        title: "Attachment renamed",
        description: "The file keeps its original storage path.",
      });
      onClose();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogTitle>Rename attachment</DialogTitle>
          <DialogDescription>
            Change how the file appears on this assignment. The stored file and
            its download link stay the same.
          </DialogDescription>

          <div className="mt-5 space-y-2">
            <Label htmlFor="attachment-name">File name</Label>
            <div className="flex">
              <Input
                id="attachment-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={Math.max(
                  1,
                  ATTACHMENT_FILENAME_MAX - extension.length,
                )}
                autoFocus
                disabled={isSaving}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "attachment-name-error" : undefined}
                className="rounded-r-none"
              />
              {extension ? (
                <span className="border-input bg-subtle text-muted-foreground flex items-center rounded-r-md border border-l-0 px-3 text-sm">
                  {extension}
                </span>
              ) : null}
            </div>
            {error ? (
              <p
                id="attachment-name-error"
                className="text-danger text-sm"
              >
                {error}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || name.trim().length === 0}
              aria-busy={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                  Saving...
                </>
              ) : (
                "Save name"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function fileExtension(filename: string): string {
  const separator = filename.lastIndexOf(".");

  return separator > 0 ? filename.slice(separator) : "";
}

function fileStem(filename: string): string {
  const separator = filename.lastIndexOf(".");

  return separator > 0 ? filename.slice(0, separator) : filename;
}

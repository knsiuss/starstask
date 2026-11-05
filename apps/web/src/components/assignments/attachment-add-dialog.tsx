"use client";

import { Loader2, Paperclip, Plus } from "lucide-react";
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
import { useToast } from "@/components/ui/toast";
import {
  ASSIGNMENT_ATTACHMENTS_MAX,
  ASSIGNMENT_ATTACHMENT_MAX_BYTES,
  ATTACHMENT_ALLOWED_EXTENSIONS,
} from "@starstask/contracts";
import { formatFileSize } from "@starstask/shared";

type AttachmentAddDialogProps = {
  assignmentId: string;
  attachmentCount: number;
};

export function AttachmentAddDialog({
  assignmentId,
  attachmentCount,
}: AttachmentAddDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const remaining = Math.max(0, ASSIGNMENT_ATTACHMENTS_MAX - attachmentCount);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isUploading) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      setFile(null);
      setError(null);
    }
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setError(null);

    if (!selected) {
      return;
    }

    const extension = selected.name.split(".").pop()?.toLowerCase() ?? "";

    if (
      !(ATTACHMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(extension)
    ) {
      setError(
        "Choose a PDF, DOCX, PPTX, XLSX, PNG, JPG, CSV, IPYNB, TXT, PY, JS, ZIP file.",
      );
      return;
    }

    if (selected.size > ASSIGNMENT_ATTACHMENT_MAX_BYTES) {
      setError("Each file must be 10 MB or smaller.");
    }
  };

  const upload = async () => {
    if (!file || isUploading) {
      return;
    }

    setIsUploading(true);
    setError(null);

    const form = new FormData();
    form.append("files", file);

    try {
      const response = await fetch(
        `/api/assignments/${assignmentId}/attachments`,
        { method: "POST", body: form },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: {
            message?: string;
            fieldErrors?: { attachments?: string };
          };
        } | null;
        setError(
          body?.error?.fieldErrors?.attachments ??
            body?.error?.message ??
            "Could not add the attachment.",
        );
        return;
      }

      toast({
        variant: "success",
        title: "Attachment added",
        description: `${file.name} is now available on this assignment.`,
      });
      setFile(null);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  if (remaining === 0) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled
        title={`This assignment already has ${ASSIGNMENT_ATTACHMENTS_MAX} attachments.`}
      >
        <Paperclip
          aria-hidden="true"
          className="h-4 w-4"
        />
        Attachment limit reached
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
        >
          <Plus
            aria-hidden="true"
            className="h-4 w-4"
          />
          Add attachment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Add attachment</DialogTitle>
        <DialogDescription>
          Attach one file. {remaining} of {ASSIGNMENT_ATTACHMENTS_MAX} slots
          remain. PDF, DOCX, PPTX, XLSX, PNG, JPG, CSV, IPYNB, TXT, PY, JS, ZIP
          up to 10 MB.
        </DialogDescription>

        <div className="mt-5 space-y-3">
          <label
            htmlFor="attachment-file"
            className="text-foreground text-sm font-medium"
          >
            File
          </label>
          <input
            id="attachment-file"
            type="file"
            accept={ATTACHMENT_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(
              ",",
            )}
            onChange={handleFile}
            disabled={isUploading}
            className="text-muted-foreground file:bg-accent-soft file:text-accent focus-visible:outline-accent block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
          />

          {file ? (
            <p className="text-muted-foreground text-xs">
              {file.name} · {formatFileSize(file.size)}
            </p>
          ) : null}

          {error ? <Alert variant="error">{error}</Alert> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void upload()}
            disabled={!file || isUploading || Boolean(error)}
            aria-busy={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
                Uploading...
              </>
            ) : (
              "Add attachment"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

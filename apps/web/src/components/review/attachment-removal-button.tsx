"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AttachmentRemovalButtonProps = {
  assignmentId: string;
  attachmentId: string;
  filename: string;
};

/**
 * Removes a sensitive attachment from a published or pending assignment.
 *
 * The database row is deleted first so the file stops resolving through signed
 * URLs; the storage object is then deleted with the service role. A reason is
 * mandatory and recorded in the audit trail.
 */
export function AttachmentRemovalButton({
  assignmentId,
  attachmentId,
  filename,
}: AttachmentRemovalButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);

  const remove = async () => {
    if (reason.trim().length < 3) {
      setError("Give a short reason for removing this attachment.");
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/assignments/${assignmentId}/attachments/${attachmentId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not remove the attachment.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div>
      {!isOpen ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setIsOpen(true)}
          className="text-danger"
        >
          <Trash2
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Remove
        </Button>
      ) : (
        <div className="mt-2 space-y-2">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Label
            htmlFor={`removal-reason-${attachmentId}`}
            className="text-xs"
          >
            Why should {filename} be removed?
          </Label>
          <Textarea
            id={`removal-reason-${attachmentId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            maxLength={2_000}
            required
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={() => void remove()}
              disabled={isBusy}
            >
              {isBusy ? (
                <Loader2
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin"
                />
              ) : null}
              Remove file
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsOpen(false);
                setReason("");
                setError(null);
              }}
              disabled={isBusy}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

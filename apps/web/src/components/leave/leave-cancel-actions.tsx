"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LEAVE_CANCELLATION_NOTE_MAX } from "@starstask/contracts";

type LeaveCancelActionsProps = {
  requestId: string;
  isClassAdmin?: boolean;
};

/**
 * Cancels a request that has not been forwarded.
 *
 * The note is optional. It is recorded for the audit trail, and a class admin
 * cancelling a student's request should use it to explain why.
 */
export function LeaveCancelActions({
  requestId,
  isClassAdmin = false,
}: LeaveCancelActionsProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onCancel() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/leave-requests/${requestId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message: string };
        } | null;

        setError(body?.error?.message ?? "Could not cancel the request.");
        return;
      }

      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        Cancel this request
      </Button>
    );
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onCancel();
      }}
    >
      {error ? (
        <Alert variant="error">
          <p className="font-medium">{error}</p>
        </Alert>
      ) : null}

      <div>
        <Label htmlFor="cancellationNote">
          Reason{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="cancellationNote"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={LEAVE_CANCELLATION_NOTE_MAX}
          className="mt-1"
          placeholder={
            isClassAdmin
              ? "Tell the student why this request is being cancelled."
              : "Anything your class admin should know."
          }
        />
      </div>

      <p className="text-muted-foreground text-xs">
        {isClassAdmin
          ? "The student is notified. A forwarded request can no longer be cancelled in StarsTask."
          : "This cannot be undone. Once a request is forwarded, it belongs to the lecturer's process."}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="danger"
          disabled={busy}
        >
          {busy ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : null}
          Cancel request
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Keep it
        </Button>
      </div>
    </form>
  );
}

"use client";

import { Loader2, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  VERIFICATION_NOTE_MAX,
  toFieldErrors,
  verificationRevokeSchema,
} from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Removes the class admin assignment that an approval created.
 *
 * Only the assignment for this class is deleted; the verified record and the
 * audit history stay in place.
 */
export function VerificationRevokeForm({
  requestId,
  className,
  studentName,
}: {
  requestId: string;
  className: string;
  studentName: string;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [confirmRevoke, setConfirmRevoke] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setError(null);
    setFieldErrors({});

    const parsed = verificationRevokeSchema.safeParse({ note, confirmRevoke });

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      setError(
        errors.note ??
          errors.confirmRevoke ??
          "Explain why access is being revoked.",
      );
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        `/api/admin/verifications/${requestId}/revoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not revoke access.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-4"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="space-y-1.5">
        <Label htmlFor="verification-revoke-note">
          Reason for revoking access
        </Label>
        <Textarea
          id="verification-revoke-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={VERIFICATION_NOTE_MAX}
          required
          aria-required
          aria-invalid={Boolean(fieldErrors.note)}
          disabled={busy}
        />
        {fieldErrors.note ? (
          <p className="text-danger text-xs">{fieldErrors.note}</p>
        ) : null}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmRevoke}
          onChange={(event) => setConfirmRevoke(event.target.checked)}
          className="mt-0.5"
          disabled={busy}
          aria-invalid={Boolean(fieldErrors.confirmRevoke)}
        />
        <span>
          I confirm {studentName} loses class admin access to {className}.
          <span className="text-muted-foreground mt-0.5 block text-xs">
            The verified record stays, but the class admin assignment is removed
            and the student is notified.
          </span>
        </span>
      </label>

      {fieldErrors.confirmRevoke ? (
        <p className="text-danger text-xs">{fieldErrors.confirmRevoke}</p>
      ) : null}

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
        ) : (
          <ShieldOff
            aria-hidden="true"
            className="h-4 w-4"
          />
        )}
        Revoke class admin access
      </Button>
    </form>
  );
}

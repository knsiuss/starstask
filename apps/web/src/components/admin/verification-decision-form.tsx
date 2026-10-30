"use client";

import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  VERIFICATION_DECISIONS,
  VERIFICATION_NOTE_MAX,
  toFieldErrors,
  verificationDecisionSchema,
  type VerificationDecision,
} from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DECISION_LABELS: Record<
  VerificationDecision,
  { title: string; description: string }
> = {
  approve: {
    title: "Approve",
    description:
      "Marks the request verified and creates a class admin assignment for this class.",
  },
  request_revision: {
    title: "Request revision",
    description:
      "Sends the request back to the student with your note. No permissions change.",
  },
  reject: {
    title: "Reject",
    description:
      "Ends the request with your note. No class admin access is granted.",
  },
};

/**
 * Platform admin decision.
 *
 * Approval is the only path that creates class admin access, and it is limited
 * to the class on this request. The database repeats the role and state checks.
 */
export function VerificationDecisionForm({
  requestId,
  className,
  studentName,
}: {
  requestId: string;
  className: string;
  studentName: string;
}) {
  const router = useRouter();
  const [decision, setDecision] =
    React.useState<VerificationDecision>("approve");
  const [note, setNote] = React.useState("");
  const [confirmGrant, setConfirmGrant] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );

  const noteRequired = decision !== "approve";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setError(null);
    setFieldErrors({});

    const parsed = verificationDecisionSchema.safeParse({
      decision,
      note,
      confirmGrant,
    });

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      setError(errors.note ?? errors.confirmGrant ?? "Check the decision.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        `/api/admin/verifications/${requestId}/decision`,
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
        setError(body?.error?.message ?? "Could not record the decision.");
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

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Decision</legend>
        {VERIFICATION_DECISIONS.map((value) => (
          <label
            key={value}
            className="border-border flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm"
          >
            <input
              type="radio"
              name="decision"
              value={value}
              checked={decision === value}
              onChange={() => setDecision(value)}
              className="mt-0.5"
              disabled={busy}
            />
            <span>
              <span className="font-medium">
                {DECISION_LABELS[value].title}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-xs">
                {DECISION_LABELS[value].description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {decision === "approve" ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmGrant}
            onChange={(event) => setConfirmGrant(event.target.checked)}
            className="mt-0.5"
            disabled={busy}
            aria-invalid={Boolean(fieldErrors.confirmGrant)}
          />
          <span>
            I confirm this creates a class admin assignment for {studentName} in{" "}
            {className}.
            <span className="text-muted-foreground mt-0.5 block text-xs">
              The assignment is scoped to this class and recorded in the audit
              log. It can be revoked later.
            </span>
          </span>
        </label>
      ) : null}

      {fieldErrors.confirmGrant ? (
        <p className="text-danger text-xs">{fieldErrors.confirmGrant}</p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="verification-decision-note">
          {noteRequired ? "Reason for the student" : "Note (optional)"}
        </Label>
        <Textarea
          id="verification-decision-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          maxLength={VERIFICATION_NOTE_MAX}
          required={noteRequired}
          aria-required={noteRequired}
          aria-invalid={Boolean(fieldErrors.note)}
          disabled={busy}
        />
        {fieldErrors.note ? (
          <p className="text-danger text-xs">{fieldErrors.note}</p>
        ) : null}
      </div>

      <Button
        type="submit"
        variant={
          decision === "reject"
            ? "danger"
            : decision === "request_revision"
              ? "secondary"
              : "primary"
        }
        disabled={busy}
      >
        {busy ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
          />
        ) : decision === "approve" ? (
          <CheckCircle2
            aria-hidden="true"
            className="h-4 w-4"
          />
        ) : decision === "reject" ? (
          <XCircle
            aria-hidden="true"
            className="h-4 w-4"
          />
        ) : (
          <RotateCcw
            aria-hidden="true"
            className="h-4 w-4"
          />
        )}
        {decision === "approve"
          ? "Approve and grant access"
          : decision === "reject"
            ? "Reject request"
            : "Request revision"}
      </Button>
    </form>
  );
}

"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { assignmentReviewSchema, toFieldErrors } from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ReviewDecisionFormProps = {
  classSlug: string;
  submissionId: string;
};

/**
 * Approve or reject one submission.
 *
 * Approval requires an explicit confirmation because it publishes the
 * assignment and its attachments to signed-in students. Rejection requires a
 * reason that the submitter can act on.
 */
export function ReviewDecisionForm({
  classSlug,
  submissionId,
}: ReviewDecisionFormProps) {
  const router = useRouter();
  const [decision, setDecision] = React.useState<"approved" | "rejected">(
    "approved",
  );
  const [reason, setReason] = React.useState("");
  const [confirmPublic, setConfirmPublic] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [isBusy, setIsBusy] = React.useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    setError(null);
    setFieldErrors({});

    const parsed = assignmentReviewSchema.safeParse({
      decision,
      reason: reason || undefined,
      confirmPublic,
    });

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      setError(
        errors.reason ??
          errors.confirmPublic ??
          "Check the decision details and try again.",
      );
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/submissions/${submissionId}/review`,
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
        setError(body?.error?.message ?? "Could not record the review.");
        return;
      }

      router.push(
        `/dashboard/classes/${classSlug}/manage?reviewed=${
          decision === "approved" ? "approved" : "rejected"
        }`,
      );
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-4"
    >
      <Alert variant="warning">
        <p className="font-medium">Approval publishes this assignment.</p>
        <p className="mt-1">
          It will appear in StarsTask search and be readable by signed-in
          students. Approved attachments can also be downloaded by them. Remove
          any sensitive personal data or restricted document before approving.
        </p>
      </Alert>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Decision</legend>
        <label className="border-border flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
          <input
            type="radio"
            name="decision"
            value="approved"
            checked={decision === "approved"}
            onChange={() => setDecision("approved")}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Approve and publish</span>
            <span className="text-muted-foreground mt-0.5 block text-xs">
              The submission and its attachments become public immediately.
            </span>
          </span>
        </label>
        <label className="border-border flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
          <input
            type="radio"
            name="decision"
            value="rejected"
            checked={decision === "rejected"}
            onChange={() => setDecision("rejected")}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Reject and request changes</span>
            <span className="text-muted-foreground mt-0.5 block text-xs">
              The submitter is notified and can revise and resubmit.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="review-reason">
          {decision === "rejected"
            ? "Reason for rejection"
            : "Note to the submitter (optional)"}
        </Label>
        <Textarea
          id="review-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          maxLength={2_000}
          required={decision === "rejected"}
          aria-required={decision === "rejected"}
          aria-invalid={Boolean(fieldErrors.reason)}
          placeholder={
            decision === "rejected"
              ? "Explain exactly what must change before resubmission."
              : "Optional note recorded with the decision."
          }
        />
        {fieldErrors.reason ? (
          <p className="text-danger text-xs">{fieldErrors.reason}</p>
        ) : null}
      </div>

      {decision === "approved" ? (
        <div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmPublic}
              onChange={(event) => setConfirmPublic(event.target.checked)}
              className="mt-0.5"
              aria-invalid={Boolean(fieldErrors.confirmPublic)}
            />
            <span>
              I reviewed the files and confirm this assignment has no personal
              data, grades, or restricted documents, and may be published
              publicly.
            </span>
          </label>
          {fieldErrors.confirmPublic ? (
            <p className="text-danger mt-1 text-xs">
              {fieldErrors.confirmPublic}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {decision === "approved" ? (
          <Button
            type="submit"
            disabled={isBusy || !confirmPublic}
          >
            {isBusy ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <CheckCircle2
                aria-hidden="true"
                className="h-4 w-4"
              />
            )}
            Approve and publish
          </Button>
        ) : (
          <Button
            type="submit"
            variant="danger"
            disabled={isBusy}
          >
            {isBusy ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <XCircle
                aria-hidden="true"
                className="h-4 w-4"
              />
            )}
            Reject submission
          </Button>
        )}
      </div>
    </form>
  );
}

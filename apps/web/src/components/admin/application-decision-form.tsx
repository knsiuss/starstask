"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  classApplicationDecisionSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ApplicationDecisionFormProps = {
  applicationId: string;
};

/**
 * Approves or rejects a class application as a platform admin.
 *
 * Approval creates the class and makes the applicant a member. The applicant
 * only becomes its class admin if the reviewer explicitly asks for it here; the
 * applicant can never grant themselves that role.
 */
export function ApplicationDecisionForm({
  applicationId,
}: ApplicationDecisionFormProps) {
  const router = useRouter();
  const [decision, setDecision] = React.useState<"approved" | "rejected">(
    "approved",
  );
  const [note, setNote] = React.useState("");
  const [grantClassAdmin, setGrantClassAdmin] = React.useState(false);
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

    const parsed = classApplicationDecisionSchema.safeParse({
      decision,
      note: note || undefined,
      grantClassAdmin,
    });

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      setError(errors.note ?? "Check the decision and try again.");
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch(
        `/api/admin/class-applications/${applicationId}/decision`,
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

      router.push(`/admin?decided=${decision}`);
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
            <span className="font-medium">Approve</span>
            <span className="text-muted-foreground mt-0.5 block text-xs">
              Creates the class, adds the applicant as a member, and publishes
              the class page.
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
            <span className="font-medium">Reject</span>
            <span className="text-muted-foreground mt-0.5 block text-xs">
              The applicant is notified with your reason and may correct and
              resubmit.
            </span>
          </span>
        </label>
      </fieldset>

      {decision === "approved" ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={grantClassAdmin}
            onChange={(event) => setGrantClassAdmin(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            Make the applicant the initial class admin
            <span className="text-muted-foreground mt-0.5 block text-xs">
              Optional. Without this, the class has no admin until you assign
              one from the class management page.
            </span>
          </span>
        </label>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="decision-note">
          {decision === "rejected" ? "Reason for rejection" : "Note (optional)"}
        </Label>
        <Textarea
          id="decision-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          maxLength={2_000}
          required={decision === "rejected"}
          aria-required={decision === "rejected"}
          aria-invalid={Boolean(fieldErrors.note)}
        />
        {fieldErrors.note ? (
          <p className="text-danger text-xs">{fieldErrors.note}</p>
        ) : null}
      </div>

      <Button
        type="submit"
        variant={decision === "rejected" ? "danger" : "primary"}
        disabled={isBusy}
      >
        {isBusy ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
          />
        ) : decision === "rejected" ? (
          <XCircle
            aria-hidden="true"
            className="h-4 w-4"
          />
        ) : (
          <CheckCircle2
            aria-hidden="true"
            className="h-4 w-4"
          />
        )}
        {decision === "rejected" ? "Reject application" : "Approve application"}
      </Button>

      <p className="text-muted-foreground text-xs">
        Reviewers are recorded with the decision. You cannot approve an
        application on behalf of a class admin role you do not hold, and class
        admins cannot decide applications.
      </p>
    </form>
  );
}

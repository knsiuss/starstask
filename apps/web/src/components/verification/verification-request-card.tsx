"use client";

import { Loader2, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  VERIFICATION_STATEMENT_MAX,
  VERIFICATION_STATEMENT_MIN,
  toFieldErrors,
  verificationRequestReviseSchema,
  type VerificationStatus,
} from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

import { StatusBadge } from "@/components/classes/status-badge";
import { VerificationEvidenceManager } from "@/components/verification/verification-evidence-manager";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { VerificationEvidenceDownload } from "@/features/verification/evidence-service";

export type VerificationRequestCardData = {
  id: string;
  className: string;
  classSlug: string;
  status: VerificationStatus;
  statement: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  hasClassAdminAccess: boolean;
};

/**
 * One request and everything the student may do with it.
 *
 * Reviewers only ever see submitted requests, and only a platform admin
 * decision can move a request to `verified` or create class admin access.
 */
export function VerificationRequestCard({
  request,
  evidence,
}: {
  request: VerificationRequestCardData;
  evidence: VerificationEvidenceDownload[];
}) {
  const router = useRouter();
  const [statement, setStatement] = React.useState(request.statement ?? "");
  const [busy, setBusy] = React.useState<"save" | "submit" | "discard" | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [message, setMessage] = React.useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = React.useState(false);

  const isDraft = request.status === "pending" && request.submittedAt === null;
  const editable = isDraft || request.status === "needs_revision";
  const statementChanged = statement !== (request.statement ?? "");

  async function saveStatement() {
    setError(null);
    setFieldErrors({});
    setMessage(null);

    const parsed = verificationRequestReviseSchema.safeParse({ statement });

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      setError(errors.statement ?? "Check the explanation and retry.");
      return;
    }

    setBusy("save");

    try {
      const response = await fetch(`/api/verification/requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not save the explanation.");
        return;
      }

      setMessage("Explanation saved.");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    setError(null);
    setMessage(null);
    setBusy("submit");

    try {
      const response = await fetch(
        `/api/verification/requests/${request.id}/submit`,
        { method: "POST" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;

        setError(body?.error?.message ?? "Could not submit the request.");
        return;
      }

      setMessage("Submitted for review.");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function discard() {
    setError(null);
    setBusy("discard");

    try {
      const response = await fetch(`/api/verification/requests/${request.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;

        setError(body?.error?.message ?? "Could not discard the draft.");
        return;
      }

      setDiscardOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border-border bg-surface rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{request.className}</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {request.submittedAt
              ? `Submitted ${formatDate(request.submittedAt)}`
              : "Draft — not submitted yet"}
            {request.reviewedAt
              ? ` · Reviewed ${formatDate(request.reviewedAt)}`
              : ""}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {isDraft ? (
        <Alert
          variant="info"
          className="mt-4"
        >
          Reviewers cannot see this request until you attach evidence and submit
          it.
        </Alert>
      ) : null}

      {request.status === "pending" && request.submittedAt ? (
        <Alert
          variant="info"
          className="mt-4"
        >
          Waiting for a platform admin to review the evidence. You will get a
          notification when a decision is recorded.
        </Alert>
      ) : null}

      {request.status === "needs_revision" ? (
        <Alert
          variant="warning"
          className="mt-4"
        >
          <p className="font-medium">The reviewer asked for changes.</p>
          {request.reviewNote ? (
            <p className="mt-1 whitespace-pre-line">{request.reviewNote}</p>
          ) : null}
          <p className="mt-1">
            Update the explanation or evidence, then submit the request again.
          </p>
        </Alert>
      ) : null}

      {request.status === "rejected" ? (
        <Alert
          variant="error"
          className="mt-4"
        >
          <p className="font-medium">This request was rejected.</p>
          {request.reviewNote ? (
            <p className="mt-1 whitespace-pre-line">{request.reviewNote}</p>
          ) : null}
          <p className="mt-1">
            No class admin access was granted. You can start a new request for
            this class.
          </p>
        </Alert>
      ) : null}

      {request.status === "verified" ? (
        <Alert
          variant={request.hasClassAdminAccess ? "success" : "warning"}
          className="mt-4"
        >
          <p className="font-medium">Verified for {request.className}.</p>
          {request.hasClassAdminAccess ? (
            <p className="mt-1">
              You have class admin access for this class.{" "}
              <Link
                href={`/dashboard/classes/${request.classSlug}`}
                className="underline underline-offset-4"
              >
                Open class management
              </Link>
            </p>
          ) : (
            <p className="mt-1">
              Class admin access is not currently active for this class.
            </p>
          )}
          {request.reviewNote ? (
            <p className="mt-1 whitespace-pre-line">{request.reviewNote}</p>
          ) : null}
        </Alert>
      ) : null}

      {error ? (
        <Alert
          variant="error"
          className="mt-4"
        >
          {error}
        </Alert>
      ) : null}

      {message ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          {message}
        </Alert>
      ) : null}

      <div className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={`statement-${request.id}`}>
            Why you are the class representative
          </Label>
          {editable ? (
            <>
              <Textarea
                id={`statement-${request.id}`}
                value={statement}
                onChange={(event) => setStatement(event.target.value)}
                rows={4}
                maxLength={VERIFICATION_STATEMENT_MAX}
                disabled={busy !== null}
                aria-invalid={Boolean(fieldErrors.statement)}
              />
              <p className="text-muted-foreground text-xs">
                {VERIFICATION_STATEMENT_MIN}–{VERIFICATION_STATEMENT_MAX}{" "}
                characters when not empty. Shown to the reviewer only.
              </p>
              {fieldErrors.statement ? (
                <p className="text-danger text-xs">{fieldErrors.statement}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm whitespace-pre-line">
              {request.statement ?? (
                <span className="text-muted-foreground">
                  No explanation was provided.
                </span>
              )}
            </p>
          )}
        </div>

        <div>
          <p className="text-foreground mb-2 text-sm font-medium">
            Supporting evidence
          </p>
          <VerificationEvidenceManager
            requestId={request.id}
            views={evidence}
            editable={editable}
          />
        </div>

        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void saveStatement()}
              disabled={busy !== null || !statementChanged}
            >
              {busy === "save" ? (
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : null}
              Save explanation
            </Button>

            <Button
              type="button"
              onClick={() => void submit()}
              disabled={busy !== null || evidence.length === 0}
            >
              {busy === "submit" ? (
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : (
                <Send
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              )}
              {request.status === "needs_revision"
                ? "Resubmit for review"
                : "Submit for review"}
            </Button>

            {isDraft ? (
              <Dialog
                open={discardOpen}
                onOpenChange={setDiscardOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy !== null}
                  >
                    <Trash2
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                    Discard draft
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Discard this draft?</DialogTitle>
                  <DialogDescription>
                    The request, its explanation, and its uploaded files are
                    deleted. You can start a new request afterwards.
                  </DialogDescription>
                  <div className="mt-5 flex justify-end gap-2">
                    <DialogClose asChild>
                      <Button
                        type="button"
                        variant="secondary"
                      >
                        Keep draft
                      </Button>
                    </DialogClose>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => void discard()}
                      disabled={busy === "discard"}
                    >
                      {busy === "discard" ? (
                        <Loader2
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin"
                        />
                      ) : null}
                      Discard
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

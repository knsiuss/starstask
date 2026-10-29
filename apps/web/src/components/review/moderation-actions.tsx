"use client";

import { Archive, EyeOff, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  assignmentModerationSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ModerationActionsProps = {
  assignmentId: string;
  status: string;
  redirectTo: string;
  /** Restoring is a platform-level decision; class admins may not undo it. */
  canRestore: boolean;
};

const ACTIONS = {
  unpublish: { label: "Unpublish", icon: EyeOff, variant: "danger" as const },
  archive: { label: "Archive", icon: Archive, variant: "secondary" as const },
  restore: { label: "Restore", icon: RotateCcw, variant: "secondary" as const },
};

/**
 * Post-publication moderation. A reason is required for unpublish and archive
 * and is stored in the review history and audit trail.
 */
export function ModerationActions({
  assignmentId,
  status,
  redirectTo,
  canRestore,
}: ModerationActionsProps) {
  const router = useRouter();
  const [action, setAction] = React.useState<
    "unpublish" | "archive" | "restore"
  >(status === "published" ? "unpublish" : "restore");
  const [reason, setReason] = React.useState("");
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

    const parsed = assignmentModerationSchema.safeParse({
      action,
      reason: reason || undefined,
    });

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      setError(errors.reason ?? "A moderation reason is required.");
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch(
        `/api/assignments/${assignmentId}/moderation`,
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
        setError(body?.error?.message ?? "Could not apply the action.");
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const selected = ACTIONS[action];
  const Icon = selected.icon;

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-3"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {status === "published" ? (
          <>
            <ActionButton
              action="unpublish"
              current={action}
              onSelect={setAction}
            />
            <ActionButton
              action="archive"
              current={action}
              onSelect={setAction}
            />
          </>
        ) : canRestore ? (
          <ActionButton
            action="restore"
            current={action}
            onSelect={setAction}
          />
        ) : (
          <p className="text-muted-foreground text-xs">
            Only a platform admin can restore this assignment.
          </p>
        )}
      </div>

      {action !== "restore" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`moderation-reason-${assignmentId}`}>
            Moderation reason
          </Label>
          <Textarea
            id={`moderation-reason-${assignmentId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            maxLength={2_000}
            required
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.reason)}
            placeholder="Record why this content is being unpublished or archived."
          />
          {fieldErrors.reason ? (
            <p className="text-danger text-xs">{fieldErrors.reason}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Restoring makes the assignment public again. Only a platform admin can
          undo a moderation decision, and only after reviewing the content.
        </p>
      )}

      <Button
        type="submit"
        variant={selected.variant}
        size="sm"
        disabled={isBusy || (action === "restore" && !canRestore)}
      >
        {isBusy ? (
          <Loader2
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin"
          />
        ) : (
          <Icon
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        )}
        {selected.label}
      </Button>
    </form>
  );
}

function ActionButton({
  action,
  current,
  onSelect,
}: {
  action: "unpublish" | "archive" | "restore";
  current: string;
  onSelect: (action: "unpublish" | "archive" | "restore") => void;
}) {
  const meta = ACTIONS[action];

  return (
    <Button
      type="button"
      size="sm"
      variant={current === action ? "secondary" : "ghost"}
      aria-pressed={current === action}
      onClick={() => onSelect(action)}
    >
      {meta.label}
    </Button>
  );
}

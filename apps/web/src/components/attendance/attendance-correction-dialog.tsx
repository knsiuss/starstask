"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";

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
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type {
  AttendanceCorrectionAuditEntry,
  AttendanceMeetingRosterEntry,
} from "@/lib/attendance/meeting-types";
import {
  ATTENDANCE_MEETING_CELL_LABELS,
  attendanceMeetingCorrectionSchema,
  toFieldErrors,
  type AttendanceMeetingCellStatus,
} from "@starstask/contracts";

type Props = {
  classSlug: string;
  sessionId: string;
  entry: AttendanceMeetingRosterEntry;
  onDone: () => void;
};

const CORRECTION_STATUSES = [
  "present",
  "late",
  "excused",
  "sick",
  "absent",
] as const;

type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

/**
 * Manager-only correction dialog.
 *
 * A present-mark requires an explicit physical-verification attestation; the
 * server enforces the same rule, so the checkbox is UX, not security.
 */
export function AttendanceCorrectionDialog({
  classSlug,
  sessionId,
  entry,
  onDone,
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<CorrectionStatus>("present");
  const [reason, setReason] = React.useState("");
  const [physicallyVerified, setPhysicallyVerified] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [history, setHistory] = React.useState<
    AttendanceCorrectionAuditEntry[]
  >([]);

  const currentStatus =
    (entry.status as AttendanceMeetingCellStatus | string) ?? "not_recorded";
  const currentLabel =
    currentStatus in ATTENDANCE_MEETING_CELL_LABELS
      ? ATTENDANCE_MEETING_CELL_LABELS[
          currentStatus as keyof typeof ATTENDANCE_MEETING_CELL_LABELS
        ]
      : currentStatus;

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setFieldErrors({});
    let cancelled = false;

    fetch(
      `/api/classes/${classSlug}/attendance/meetings/${sessionId}/corrections`,
      {
        cache: "no-store",
      },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled && Array.isArray(body?.data)) {
          setHistory(
            body.data.filter(
              (item: AttendanceCorrectionAuditEntry) =>
                item.studentId === entry.userId,
            ),
          );
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [open, classSlug, sessionId, entry.userId]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setError(null);
    setFieldErrors({});

    const parsed = attendanceMeetingCorrectionSchema.safeParse({
      userId: entry.userId,
      status,
      reason,
      physicallyVerified,
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      setError("Check the highlighted fields.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/classes/${classSlug}/attendance/meetings/${sessionId}/corrections`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fieldErrors ?? {});
        setError(body?.error?.message ?? "Could not record the correction.");
        return;
      }

      toast({ variant: "success", title: "Correction recorded" });
      setOpen(false);
      setReason("");
      setPhysicallyVerified(false);
      onDone();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        Correct
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent>
          <DialogTitle>Manual correction — {entry.fullName}</DialogTitle>
          <DialogDescription>
            Only use this when you physically verified the student at the
            attendance location and a technical problem prevented a GPS
            check-in. A student who is genuinely absent or outside the area
            cannot be marked present.
          </DialogDescription>

          <p className="mt-3 text-sm">
            Current status: <span className="font-medium">{currentLabel}</span>
          </p>

          <form
            onSubmit={(e) => void submit(e)}
            className="mt-4 space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="correction-status">New status</Label>
              <Select
                id="correction-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as CorrectionStatus)}
                aria-invalid={Boolean(fieldErrors.status)}
              >
                {CORRECTION_STATUSES.map((option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {ATTENDANCE_MEETING_CELL_LABELS[option] ?? option}
                  </option>
                ))}
              </Select>
              {fieldErrors.status ? (
                <p className="text-danger text-xs">{fieldErrors.status}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="correction-reason">Reason (required)</Label>
              <Input
                id="correction-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                aria-invalid={Boolean(fieldErrors.reason)}
                placeholder="e.g. Student in room; GPS accuracy too poor"
              />
              {fieldErrors.reason ? (
                <p className="text-danger text-xs">{fieldErrors.reason}</p>
              ) : null}
            </div>

            {status === "present" ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={physicallyVerified}
                  onChange={(e) => setPhysicallyVerified(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  I physically verified this student is present at the
                  attendance location, within the allowed area.
                </span>
              </label>
            ) : null}
            {fieldErrors.physicallyVerified ? (
              <p className="text-danger text-xs">
                {fieldErrors.physicallyVerified}
              </p>
            ) : null}

            {error ? (
              <Alert variant="error">
                <p className="text-xs leading-relaxed">{error}</p>
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                    Saving…
                  </>
                ) : (
                  "Record correction"
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </form>

          {history.length > 0 ? (
            <div className="mt-4 border-t pt-3">
              <p className="text-xs font-medium">Correction history</p>
              <ul className="mt-2 space-y-1 text-xs">
                {history.map((item) => (
                  <li key={item.id}>
                    {item.previousStatus} → {item.newStatus} by {item.adminName}
                    : {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

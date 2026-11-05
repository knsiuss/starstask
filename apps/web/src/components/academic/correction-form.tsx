"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  ATTENDANCE_RECORD_STATUSES,
  type AttendanceRecordStatus,
} from "@starstask/contracts";

type CorrectionFormProps = {
  classSlug: string;
  recordId: string;
  currentStatus: AttendanceRecordStatus;
};

/**
 * Compact inline correction form for one record. A written reason (≥3 chars)
 * is mandatory; the server appends to the correction ledger.
 */
export function CorrectionForm({
  classSlug,
  recordId,
  currentStatus,
}: CorrectionFormProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [newStatus, setNewStatus] =
    React.useState<AttendanceRecordStatus>(currentStatus);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/academic/attendance/corrections`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordId, newStatus, reason }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          body?.error?.message ?? "Could not correct the record.",
        );
      }

      setOpen(false);
      setReason("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected error.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Correct
      </Button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-2 flex flex-wrap items-center gap-2"
    >
      <select
        aria-label="Corrected status"
        className="border-border bg-background rounded-lg border px-2 py-1.5 text-sm"
        value={newStatus}
        onChange={(event) =>
          setNewStatus(event.target.value as AttendanceRecordStatus)
        }
      >
        {ATTENDANCE_RECORD_STATUSES.map((status) => (
          <option
            key={status}
            value={status}
          >
            {status}
          </option>
        ))}
      </select>
      <input
        type="text"
        required
        minLength={3}
        maxLength={2000}
        placeholder="Reason (required)"
        className="border-border bg-background w-48 rounded-lg border px-2 py-1.5 text-sm"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={pending}
      >
        {pending ? "Saving…" : "Save"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(false)}
      >
        Cancel
      </Button>
      {error ? <p className="text-danger w-full text-xs">{error}</p> : null}
    </form>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  ATTENDANCE_RECORD_STATUSES,
  type AttendanceRecordStatus,
} from "@starstask/contracts";

export type RosterEntry = {
  studentIdentityId: string;
  displayName: string | null;
  studentCode: string | null;
  currentStatus: AttendanceRecordStatus | null;
};

type AttendanceRosterProps = {
  classSlug: string;
  meetingId: string;
  entries: RosterEntry[];
};

const STATUS_LABELS: Record<AttendanceRecordStatus, string> = {
  present: "Present",
  late: "Late",
  excused: "Excused",
  sick: "Sick",
  absent: "Absent",
};

/**
 * Roster grid for one meeting. Writes go through the bulk record endpoint;
 * only enrolled identities are persisted (server re-checks).
 */
export function AttendanceRoster({
  classSlug,
  meetingId,
  entries,
}: AttendanceRosterProps) {
  const router = useRouter();
  const [statuses, setStatuses] = React.useState<
    Record<string, AttendanceRecordStatus>
  >(() => {
    const initial: Record<string, AttendanceRecordStatus> = {};

    for (const entry of entries) {
      initial[entry.studentIdentityId] = entry.currentStatus ?? "absent";
    }

    return initial;
  });
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onSaveAll() {
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/academic/attendance/records`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingId,
            entries: Object.entries(statuses).map(
              ([studentIdentityId, status]) => ({ studentIdentityId, status }),
            ),
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? "Could not record attendance.");
      }

      const body = (await response.json()) as {
        data: { upserted: number; skipped: string[] };
      };
      setMessage(
        `Recorded ${body.data.upserted} row(s).` +
          (body.data.skipped.length > 0
            ? ` Skipped ${body.data.skipped.length} not enrolled.`
            : ""),
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected error.");
    } finally {
      setPending(false);
    }
  }

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No active enrollments for this offering yet.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th className="py-2 pr-4">Student</th>
              <th className="py-2 pr-4">ID</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.studentIdentityId}
                className="border-border border-t"
              >
                <td className="py-2 pr-4">
                  {entry.displayName ?? "Unknown member"}
                </td>
                <td className="text-muted-foreground py-2 pr-4">
                  {entry.studentCode ?? "—"}
                </td>
                <td className="py-2">
                  <select
                    aria-label={`Status for ${entry.displayName ?? entry.studentIdentityId}`}
                    className="border-border bg-background rounded-lg border px-2 py-1.5"
                    value={statuses[entry.studentIdentityId]}
                    onChange={(event) =>
                      setStatuses((current) => ({
                        ...current,
                        [entry.studentIdentityId]: event.target
                          .value as AttendanceRecordStatus,
                      }))
                    }
                  >
                    {ATTENDANCE_RECORD_STATUSES.map((status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="primary"
          onClick={onSaveAll}
          disabled={pending}
        >
          {pending ? "Saving…" : "Save attendance"}
        </Button>
        {message ? <p className="text-success text-sm">{message}</p> : null}
        {error ? <p className="text-danger text-sm">{error}</p> : null}
      </div>
    </div>
  );
}

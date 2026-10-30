import { formatLeaveDate, formatLeaveDateRange } from "@starstask/shared";

import type { LeaveForwardingRecord, LeaveHistoryEntry } from "@/lib/db/leave";

const ACTION_LABELS: Record<string, string> = {
  created: "Draft created",
  updated: "Details updated",
  submitted: "Submitted to the class admin",
  // Legacy rows from the retired revision workflow still render readably.
  revision_requested: "Returned for correction",
  resubmitted: "Resubmitted for review",
  forwarded: "Forwarded to the lecturer",
  cancelled: "Cancelled",
  evidence_added: "Supporting document added",
  evidence_removed: "Supporting document removed",
  ocr_recorded: "Document read",
};

/**
 * Request history.
 *
 * Append-only on the server, so this renders every submission and status change
 * rather than only the current state.
 */
export function LeaveHistory({ entries }: { entries: LeaveHistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
    );
  }

  return (
    <ol className="border-border grid gap-3 border-l pl-4">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="relative"
        >
          <span
            aria-hidden="true"
            className="bg-border absolute top-1.5 -left-[21px] h-2 w-2 rounded-full"
          />
          <p className="text-sm font-medium">
            {ACTION_LABELS[entry.action] ?? entry.action}
          </p>
          <p className="text-muted-foreground text-xs">
            {formatLeaveDate(entry.createdAt.slice(0, 10))}
            {entry.actorName ? ` · ${entry.actorName}` : ""}
          </p>
          {entry.note ? (
            <p className="border-border mt-1.5 rounded-md border bg-muted/40 p-2 text-xs whitespace-pre-line">
              {entry.note}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Forwarding records for a class, including which requests each one carried. */
export function ForwardingHistory({
  records,
}: {
  records: LeaveForwardingRecord[];
}) {
  if (records.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No packages have been generated for this class yet.
      </p>
    );
  }

  return (
    <ul className="grid gap-3">
      {records.map((record) => (
        <li
          key={record.id}
          className="border-border rounded-xl border p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="font-mono text-[11px] tracking-wide">
                {record.reference}
              </p>
              <p className="text-sm font-medium">
                To {record.recipientName}
                {record.recipientEmail ? ` · ${record.recipientEmail}` : ""}
              </p>
            </div>
            <p className="text-muted-foreground text-xs">
              {formatLeaveDate(record.createdAt.slice(0, 10))}
              {record.forwardedByName ? ` · ${record.forwardedByName}` : ""}
            </p>
          </div>

          <p className="text-muted-foreground mt-2 text-xs">
            {record.requestCount} request
            {record.requestCount === 1 ? "" : "s"} ·{" "}
            {record.reportFormat === "complete"
              ? "Complete PDF with evidence"
              : "Summary PDF"}{" "}
            · {record.reportReference}
          </p>

          <ul className="mt-2 grid gap-1">
            {record.items.map((item) => (
              <li
                key={item.requestId}
                className="text-muted-foreground flex flex-wrap gap-x-2 text-xs"
              >
                <span className="font-mono">{item.requestReference}</span>
                <span>{item.studentDisplayName}</span>
                <span>
                  {formatLeaveDateRange(item.leaveStartDate, item.leaveEndDate)}
                </span>
              </li>
            ))}
          </ul>

          <p className="text-muted-foreground mt-2 text-[11px]">
            StarsTask generated and recorded this package. It does not indicate
            that the lecturer received the requests or decided anything.
          </p>
        </li>
      ))}
    </ul>
  );
}

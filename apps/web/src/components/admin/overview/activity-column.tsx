import { History } from "lucide-react";
import Link from "next/link";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import type { AuditLogView } from "@/lib/db/classes";
import type { PlatformDashboardCounts } from "@/lib/db/class-submissions";
import { formatDate } from "@starstask/shared";

export function ActivityColumn({
  audit,
  counts,
}: {
  audit: AuditLogView[];
  counts: PlatformDashboardCounts;
}) {
  return (
    <div className="space-y-6">
      <section
        aria-labelledby="recent-activity"
        className="border-border bg-surface rounded-xl border"
      >
        <div className="border-border border-b px-4 py-3">
          <h2
            id="recent-activity"
            className="inline-flex items-center gap-2 font-semibold tracking-tight"
          >
            <History
              aria-hidden="true"
              className="h-4 w-4"
            />
            Recent activity
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Append-only audit entries, newest first.
          </p>
        </div>

        {audit.length === 0 ? (
          <div className="p-4">
            <AdminEmptyState
              title="No activity yet"
              description="Decisions and moderation actions are recorded here."
            />
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {audit.map((entry) => (
              <li
                key={entry.id}
                className="px-4 py-2.5"
              >
                <p className="text-sm capitalize">
                  {entry.action.replaceAll("_", " ")}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {entry.entity_type.replaceAll("_", " ")}
                  {entry.class_id ? " · class scoped" : ""} ·{" "}
                  {formatDate(entry.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="platform-totals"
        className="border-border bg-surface rounded-xl border"
      >
        <div className="border-border border-b px-4 py-3">
          <h2
            id="platform-totals"
            className="text-sm font-semibold tracking-tight"
          >
            Platform totals
          </h2>
        </div>
        <dl className="divide-border divide-y text-sm">
          <Total
            label="Approved applications"
            value={counts.approvedApplications}
            href="/admin/applications?status=approved"
          />
          <Total
            label="Rejected applications"
            value={counts.rejectedApplications}
            href="/admin/applications?status=rejected"
          />
          <Total
            label="Archived classes"
            value={counts.archivedClasses}
            href="/admin/classes?status=archived"
          />
          <Total
            label="Unpublished or archived"
            value={counts.unpublishedAssignments}
            href="/admin/assignments?status=unpublished"
          />
        </dl>
      </section>
    </div>
  );
}

function Total({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <Link
          href={href}
          className="text-accent tabular-nums hover:underline"
        >
          {value.toLocaleString()}
        </Link>
      </dd>
    </div>
  );
}

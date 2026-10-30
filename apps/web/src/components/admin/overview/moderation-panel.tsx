import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { StatusBadge } from "@/components/classes/status-badge";
import type { PlatformModerationItem } from "@/lib/db/class-submissions";
import { formatDate } from "@starstask/shared";

export function ModerationPanel({
  items,
}: {
  items: PlatformModerationItem[];
}) {
  return (
    <section
      aria-labelledby="moderation"
      className="border-border bg-surface rounded-xl border lg:col-span-2"
    >
      <div className="border-border flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2
            id="moderation"
            className="inline-flex items-center gap-2 font-semibold tracking-tight"
          >
            <ShieldCheck
              aria-hidden="true"
              className="h-4 w-4"
            />
            Published content
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Recently updated class assignments. Review opens the existing
            moderation page.
          </p>
        </div>
        <Link
          href="/admin/assignments"
          className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Manage
          <ArrowRight
            aria-hidden="true"
            className="h-3 w-3"
          />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="p-4">
          <AdminEmptyState
            title="Nothing to moderate"
            description="Class assignments appear here once they reach review."
          />
        </div>
      ) : (
        <ul className="divide-border divide-y">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/dashboard/classes/${item.class_slug}/review/${item.id}`}
                  className="hover:text-accent font-medium underline-offset-4 hover:underline"
                >
                  {item.title}
                </Link>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {item.class_name} · {item.submitter.display_name} · updated{" "}
                  {formatDate(item.updated_at)}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

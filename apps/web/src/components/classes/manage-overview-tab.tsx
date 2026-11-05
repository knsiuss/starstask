import {
  Clock,
  FileText,
  History,
  Mail,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { ClassMediaManager } from "@/components/classes/class-media-manager";
import {
  getClassDashboardCounts,
  type ClassDashboardCounts,
} from "@/lib/db/class-submissions";
import { listAuditLogs } from "@/lib/db/classes";
import { formatDeadline } from "@starstask/shared";

type ManageOverviewTabProps = {
  classId: string;
  classSlug: string;
  className: string;
  avatarUrl: string | null;
  coverUrl: string | null;
};

type Metric = {
  label: string;
  value: number;
  href: string;
  icon: LucideIcon;
  tone: string;
};

function buildMetrics(base: string, counts: ClassDashboardCounts): Metric[] {
  return [
    {
      label: "Members",
      value: counts.members,
      href: `${base}?tab=members`,
      icon: Users,
      tone: "bg-accent-soft text-accent",
    },
    {
      label: "Pending review",
      value: counts.pendingReview,
      href: `${base}?tab=content&status=pending_review`,
      icon: Clock,
      tone: "bg-warning-soft text-warning",
    },
    {
      label: "Active invites",
      value: counts.activeInvitations,
      href: `${base}?tab=invites`,
      icon: Mail,
      tone: "bg-accent-soft text-accent",
    },
    {
      label: "Published content",
      value: counts.published,
      href: `${base}?tab=content&status=published`,
      icon: FileText,
      tone: "bg-success-soft text-success",
    },
  ];
}

export async function ManageOverviewTab({
  classId,
  classSlug,
  className,
  avatarUrl,
  coverUrl,
}: ManageOverviewTabProps) {
  const [counts, audit] = await Promise.all([
    getClassDashboardCounts(classId),
    listAuditLogs({ classId, page: 1, pageSize: 5 }),
  ]);
  const base = `/app/classes/${classSlug}/manage`;
  const metrics = buildMetrics(base, counts);

  return (
    <div className="mt-6 space-y-6">
      <section
        aria-label="Class summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map(({ label, value, href, icon: Icon, tone }) => (
          <Link
            key={label}
            href={href}
            className="border-border bg-surface hover:border-accent/40 flex items-center gap-3 rounded-2xl border p-4 transition-colors"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
            >
              <Icon
                aria-hidden="true"
                className="h-5 w-5"
              />
            </span>
            <span className="min-w-0">
              <span className="text-muted-foreground block text-xs font-medium">
                {label}
              </span>
              <span className="mt-0.5 block text-2xl font-semibold tracking-tight tabular-nums">
                {value}
              </span>
            </span>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section
          aria-labelledby="recent-activity"
          className="border-border bg-surface self-start rounded-2xl border"
        >
          <div className="border-border flex items-center gap-2 border-b px-5 py-4">
            <History
              aria-hidden="true"
              className="text-muted-foreground h-4 w-4"
            />
            <h2
              id="recent-activity"
              className="text-base font-semibold tracking-tight"
            >
              Recent activity
            </h2>
          </div>

          {audit.items.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-medium">No recorded activity yet</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Changes to members, invites, and settings appear here.
              </p>
            </div>
          ) : (
            <ol className="divide-border divide-y">
              {audit.items.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 px-5 py-3"
                >
                  <span
                    aria-hidden="true"
                    className="bg-accent mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {humanizeAction(entry.action)}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {entry.actor_name ? `${entry.actor_name} · ` : ""}
                      {formatDeadline(entry.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="min-w-0">
          <ClassMediaManager
            classSlug={classSlug}
            className={className}
            initialAvatarUrl={avatarUrl}
            initialCoverUrl={coverUrl}
            variant="compact"
          />
        </aside>
      </div>
    </div>
  );
}

function humanizeAction(action: string): string {
  const text = action.replaceAll("_", " ");

  return text.charAt(0).toUpperCase() + text.slice(1);
}

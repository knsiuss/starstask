import { Bell } from "lucide-react";
import Link from "next/link";

import { SectionHeader } from "@/components/dashboard/section-header";
import type { NotificationInboxItem } from "@/lib/db/notifications";
import { cn } from "@/lib/utils/cn";
import { relativeTimeFrom } from "@/lib/utils/relative-time";

type NotificationsSectionProps = {
  notifications: NotificationInboxItem[];
  /** Server render instant, passed in so the component stays pure. */
  nowIso: string;
};

/**
 * Marker colour follows the destination section, the only reliable signal in
 * the payload: review work is amber, absences green, everything else accent.
 */
function markerClass(href: string | null): string {
  if (href?.startsWith("/dashboard/review")) {
    return "bg-warning";
  }

  if (href?.startsWith("/leave-requests")) {
    return "bg-success";
  }

  return "bg-accent";
}

export function NotificationsSection({
  notifications,
  nowIso,
}: NotificationsSectionProps) {
  const now = new Date(nowIso).getTime();

  return (
    <section
      aria-labelledby="recent-notifications"
      className="border-border bg-surface rounded-xl border shadow-[0_1px_2px_rgba(9,9,11,0.03)]"
    >
      <div className="px-4 pt-4">
        <SectionHeader
          id="recent-notifications"
          title="Notifications"
          density="rail"
          action={{ href: "/notifications", label: "View all" }}
        />
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-7 text-center">
          <Bell
            aria-hidden="true"
            className="text-muted-foreground h-5 w-5"
          />
          <p className="mt-2 text-sm font-medium">No notifications yet</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Updates about your classes and account will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-border mt-1 divide-y">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <NotificationRow
                notification={notification}
                now={now}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NotificationRow({
  notification,
  now,
}: {
  notification: NotificationInboxItem;
  now: number;
}) {
  const marker = (
    <span
      aria-hidden="true"
      className={cn(
        "mt-1 h-3 w-3 shrink-0 rounded-[3px]",
        markerClass(notification.href),
      )}
    />
  );

  const content = (
    <>
      {marker}

      <span className="min-w-0 flex-1">
        <span className="text-foreground block text-[13px] font-semibold">
          {notification.title}
        </span>
        {notification.body ? (
          <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
            {notification.body}
          </span>
        ) : null}
      </span>

      <span className="text-muted-foreground mt-0.5 shrink-0 text-[11px] whitespace-nowrap">
        {relativeTimeFrom(notification.createdAt, now)}
      </span>
    </>
  );

  if (!notification.href) {
    return <div className="flex items-start gap-3 px-4 py-3">{content}</div>;
  }

  return (
    <Link
      href={notification.href}
      className="hover:bg-hover focus-visible:outline-accent flex items-start gap-3 px-4 py-3 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
    >
      {content}
    </Link>
  );
}

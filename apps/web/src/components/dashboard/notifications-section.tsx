import { Bell, ChevronRight } from "lucide-react";
import Link from "next/link";

import { SectionHeader } from "@/components/dashboard/section-header";
import type { DashboardNotification } from "@/lib/db/dashboard";
import { formatDate } from "@starstask/shared";

type NotificationsSectionProps = {
  notifications: DashboardNotification[];
};

export function NotificationsSection({
  notifications,
}: NotificationsSectionProps) {
  return (
    <section
      aria-labelledby="recent-notifications"
      className="mt-8"
    >
      <SectionHeader
        id="recent-notifications"
        title="Notifications"
        description="Recent updates about your classes and account."
        action={{ href: "/settings/notifications", label: "Settings" }}
      />

      <div className="border-border bg-surface mt-4 overflow-hidden rounded-xl border shadow-[0_1px_2px_rgba(9,9,11,0.03)]">
        {notifications.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Bell
              aria-hidden="true"
              className="text-muted-foreground mx-auto h-5 w-5"
            />
            <p className="mt-2 text-sm font-medium">No notifications yet</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
              Updates about your classes and account will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {notifications.map((notification) => (
              <li key={notification.id}>
                {notification.href ? (
                  <Link
                    href={notification.href}
                    className="hover:bg-hover focus-visible:outline-accent group flex items-start gap-3 px-4 py-3.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 sm:px-5"
                  >
                    <NotificationContent notification={notification} />
                    <ChevronRight
                      aria-hidden="true"
                      className="text-muted-foreground group-hover:text-accent mt-0.5 h-4 w-4 shrink-0 transition-colors"
                    />
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                    <NotificationContent notification={notification} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function NotificationContent({
  notification,
}: {
  notification: DashboardNotification;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
      >
        <Bell className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-foreground group-hover:text-accent line-clamp-2 text-sm font-medium sm:line-clamp-1">
          {notification.title}
        </p>
        {notification.body ? (
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">
            {notification.body}
          </p>
        ) : null}
        <p className="text-muted-foreground/80 mt-1 text-[11px]">
          {formatDate(notification.createdAt)}
        </p>
      </div>
    </>
  );
}

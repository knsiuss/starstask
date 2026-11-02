import { Bell, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/assignments/pagination";
import { SetupNotice } from "@/components/layout/setup-notice";
import { NotificationInboxList } from "@/components/notifications/notification-inbox-list";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { listNotificationInbox } from "@/lib/db/notifications";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Updates about your classes, submissions, and account.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const MAX_PAGE = 1000;

type NotificationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(parsed, MAX_PAGE);
}

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/notifications"));
  }

  const rawParams = await searchParams;
  const unreadOnly = firstValue(rawParams.filter) === "unread";
  const page = parsePage(firstValue(rawParams.page));
  const result = await listNotificationInbox({
    page,
    pageSize: PAGE_SIZE,
    unreadOnly,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Notifications
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Updates about your classes, submissions, and account.
          </p>
        </div>
        <Button
          asChild
          variant="secondary"
          size="sm"
        >
          <Link href="/settings/notifications">
            <Settings
              aria-hidden="true"
              className="h-4 w-4"
            />
            Push settings
          </Link>
        </Button>
      </div>

      <nav
        aria-label="Filter notifications"
        className="mt-6 flex flex-wrap gap-2"
      >
        <FilterTab
          href="/notifications"
          isActive={!unreadOnly}
          label="All"
        />
        <FilterTab
          href="/notifications?filter=unread"
          isActive={unreadOnly}
          label="Unread"
        />
      </nav>

      {result.items.length === 0 ? (
        <div className="border-border bg-subtle mt-8 rounded-lg border border-dashed px-6 py-14 text-center">
          <Bell
            aria-hidden="true"
            className="text-muted-foreground mx-auto h-6 w-6"
          />
          <h2 className="mt-3 text-base font-semibold">
            {unreadOnly ? "Nothing unread" : "No notifications yet"}
          </h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            {unreadOnly
              ? "You have read every notification."
              : "Updates about your classes and account will appear here, even when push is disabled."}
          </p>
          {unreadOnly ? (
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="mt-5"
            >
              <Link href="/notifications">Show all notifications</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-6">
          <NotificationInboxList
            items={result.items}
            unreadCount={result.unreadCount}
            nowIso={new Date().toISOString()}
          />
        </div>
      )}

      <Pagination
        basePath="/notifications"
        page={result.page}
        totalPages={result.totalPages}
        params={{ filter: unreadOnly ? "unread" : undefined }}
      />
    </div>
  );
}

function FilterTab({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={
        isActive
          ? "bg-foreground text-background rounded-md px-3 py-1.5 text-sm font-medium"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground rounded-md border px-3 py-1.5 text-sm font-medium"
      }
    >
      {label}
    </Link>
  );
}

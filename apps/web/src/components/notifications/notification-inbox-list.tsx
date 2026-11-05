"use client";

import { CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NotificationInboxItem } from "@/lib/db/notifications";
import { cn } from "@/lib/utils/cn";
import { relativeTimeFrom } from "@/lib/utils/relative-time";
import type { NotificationEventKindRow } from "@/types/database";

const KIND_LABELS: Record<NotificationEventKindRow, string> = {
  class_application_approved: "Class approved",
  class_application_rejected: "Class application",
  class_admin_assigned: "Class role",
  class_invitation: "Invitation",
  assignment_approved: "Approved",
  assignment_rejected: "Needs work",
  submission_received: "Review queue",
  moderation_required: "Moderated",
  session_updated: "Session updated",
  session_cancelled: "Session cancelled",
  session_rsvp: "Session",
  leave_request_submitted: "Absence request",
  leave_request_revision_requested: "Absence revision",
  leave_request_forwarded: "Absence forwarded",
  leave_request_approved: "Absence approved",
  leave_request_rejected: "Absence rejected",
  leave_request_cancelled: "Absence cancelled",
  verification_submitted: "Verification",
  verification_approved: "Verified",
  verification_rejected: "Verification",
  verification_revision_requested: "Verification",
  class_admin_revoked: "Class role",
  class_assignment_published: "New class post",
  assignment_report_reviewed: "Report",
  assignment_created: "New assignment",
  dm_message: "Message",
};

const KIND_VARIANTS: Record<NotificationEventKindRow, BadgeProps["variant"]> = {
  class_application_approved: "success",
  class_application_rejected: "danger",
  class_admin_assigned: "accent",
  class_invitation: "accent",
  assignment_approved: "success",
  assignment_rejected: "danger",
  submission_received: "warning",
  moderation_required: "warning",
  session_updated: "accent",
  session_cancelled: "danger",
  session_rsvp: "neutral",
  leave_request_submitted: "accent",
  leave_request_revision_requested: "warning",
  leave_request_forwarded: "success",
  leave_request_approved: "success",
  leave_request_rejected: "danger",
  leave_request_cancelled: "neutral",
  verification_submitted: "accent",
  verification_approved: "success",
  verification_rejected: "danger",
  verification_revision_requested: "warning",
  class_admin_revoked: "neutral",
  class_assignment_published: "accent",
  assignment_report_reviewed: "accent",
  assignment_created: "accent",
  dm_message: "accent",
};

type NotificationInboxListProps = {
  items: NotificationInboxItem[];
  unreadCount: number;
  nowIso: string;
  nextCursor: string | null;
  hasMore: boolean;
  unreadOnly: boolean;
};

type CursorPage = {
  items: NotificationInboxItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export function NotificationInboxList({
  items: initialItems,
  unreadCount,
  nowIso,
  nextCursor: initialNextCursor,
  hasMore: initialHasMore,
  unreadOnly,
}: NotificationInboxListProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraItems, setExtraItems] = useState<NotificationInboxItem[]>([]);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const now = new Date(nowIso).getTime();
  const items = [...initialItems, ...extraItems];

  async function markRead(
    body: { all: true } | { ids: string[] },
    refresh = false,
  ) {
    const response = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });

    if (!response.ok) {
      throw new Error("Could not update notifications");
    }

    if (refresh) {
      router.refresh();
    }
  }

  async function markAllRead() {
    setPending(true);
    setError(null);

    try {
      await markRead({ all: true }, true);
    } catch {
      setError("Could not update your notifications. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function markOneRead(id: string) {
    setError(null);

    try {
      await markRead({ ids: [id] }, true);
    } catch {
      setError("Could not update your notifications. Try again.");
    }
  }

  async function loadMore() {
    if (!nextCursor) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const params = new URLSearchParams({ cursor: nextCursor });

      if (unreadOnly) {
        params.set("filter", "unread");
      }

      const response = await fetch(`/api/notifications?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Could not load more notifications");
      }

      const body = (await response.json()) as { data: CursorPage };
      const page = body.data;
      const seen = new Set(items.map((item) => item.id));
      const fresh = page.items.filter((item) => !seen.has(item.id));

      setExtraItems((current) => [...current, ...fresh]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      setError("Could not load more notifications. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {unreadCount === 0
            ? "You are caught up."
            : `${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}.`}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={unreadCount === 0 || pending}
          onClick={() => void markAllRead()}
        >
          <CheckCheck
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          {pending ? "Marking…" : "Mark all as read"}
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="text-danger mt-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      <ul className="divide-border border-border mt-4 divide-y rounded-lg border">
        {items.map((item) => (
          <li key={item.id}>
            <NotificationRow
              item={item}
              now={now}
              onOpen={() => {
                if (!item.readAt) {
                  void markRead({ ids: [item.id] }).catch(() => undefined);
                }
              }}
              onMarkRead={() => void markOneRead(item.id)}
            />
          </li>
        ))}
      </ul>

      {hasMore ? (
        <div className="mt-4 text-center">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function NotificationRow({
  item,
  now,
  onOpen,
  onMarkRead,
}: {
  item: NotificationInboxItem;
  now: number;
  onOpen: () => void;
  onMarkRead: () => void;
}) {
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          item.readAt ? "bg-transparent" : "bg-accent",
        )}
      />

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant={KIND_VARIANTS[item.kind]}>
            {KIND_LABELS[item.kind]}
          </Badge>
          <span className="text-muted-foreground text-[11px]">
            {relativeTimeFrom(item.createdAt, now)}
          </span>
          {item.readAt ? null : <span className="sr-only">Unread</span>}
        </span>

        <span
          className={cn(
            "mt-1 block text-sm",
            item.readAt ? "text-foreground" : "text-foreground font-semibold",
          )}
        >
          {item.title}
        </span>
        {item.body ? (
          <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
            {item.body}
          </span>
        ) : null}
      </span>
    </>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        onClick={onOpen}
        className="hover:bg-hover focus-visible:outline-accent flex items-start gap-3 px-4 py-3.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      {content}
      {item.readAt ? null : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={onMarkRead}
        >
          Mark read
        </Button>
      )}
    </div>
  );
}

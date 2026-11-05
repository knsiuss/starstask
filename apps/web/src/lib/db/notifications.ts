import "server-only";

import {
  notificationEventPayloadSchema,
  type MarkNotificationsReadInput,
} from "@starstask/contracts";

import { DataAccessError, type PaginatedResult } from "@/lib/db/assignments";
import { decodeCursor, encodeCursor } from "@/lib/db/cursor";
import { isSafeNotificationPath } from "@/lib/push/payload";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { NotificationEventKindRow } from "@/types/database";

export type NotificationInboxItem = {
  id: string;
  kind: NotificationEventKindRow;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
};

export type NotificationInboxQuery = {
  page: number;
  pageSize: number;
  unreadOnly: boolean;
  /** Keyset cursor (`created_at` of the last seen row); page is ignored when set. */
  cursor?: string | null;
};

export type NotificationInboxPage = PaginatedResult<NotificationInboxItem> & {
  unreadCount: number;
  nextCursor: string | null;
  hasMore: boolean;
};

type NotificationRow = {
  id: string;
  kind: NotificationEventKindRow;
  payload: unknown;
  created_at: string;
  read_at: string | null;
};

function mapNotificationRow(
  row: NotificationRow,
): NotificationInboxItem | null {
  const parsed = notificationEventPayloadSchema.safeParse(row.payload);

  if (!parsed.success) {
    return null;
  }

  return {
    id: row.id,
    kind: row.kind,
    title: parsed.data.title,
    body: parsed.data.body,
    href: isSafeNotificationPath(parsed.data.url) ? parsed.data.url : null,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

/**
 * The caller's latest rows, already scoped by the select policy. This is used
 * by the dashboard rail, which shows a fixed handful and does not need counts.
 */
export async function listRecentNotifications(
  limit: number,
): Promise<NotificationInboxItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notification_events")
    .select("id, kind, payload, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataAccessError("Could not load your notifications", error.code);
  }

  return (data ?? []).flatMap((row) => {
    const mapped = mapNotificationRow(row);
    return mapped ? [mapped] : [];
  });
}

export async function listNotificationInbox(
  query: NotificationInboxQuery,
): Promise<NotificationInboxPage> {
  const supabase = await createSupabaseServerClient();
  const offset = (query.page - 1) * query.pageSize;
  const cursorTs = decodeCursor(query.cursor);
  const useCursor = query.cursor !== undefined;

  let listQuery = supabase
    .from("notification_events")
    .select("id, kind, payload, created_at, read_at", { count: "exact" });

  if (query.unreadOnly) {
    listQuery = listQuery.is("read_at", null);
  }

  if (useCursor && cursorTs) {
    listQuery = listQuery.lt("created_at", cursorTs);
  }

  const [list, unread] = await Promise.all([
    useCursor
      ? listQuery
          .order("created_at", { ascending: false })
          .range(0, query.pageSize)
      : listQuery
          .order("created_at", { ascending: false })
          .range(offset, offset + query.pageSize - 1),
    supabase
      .from("notification_events")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
  ]);

  if (list.error) {
    throw new DataAccessError(
      "Could not load your notifications",
      list.error.code,
    );
  }

  if (unread.error) {
    throw new DataAccessError(
      "Could not count your unread notifications",
      unread.error.code,
    );
  }

  const total = list.count ?? 0;
  const rawRows = list.data ?? [];
  const hasMore = useCursor && rawRows.length > query.pageSize;
  const pageRows = hasMore ? rawRows.slice(0, query.pageSize) : rawRows;
  const items = pageRows.flatMap((row) => {
    const mapped = mapNotificationRow(row);
    return mapped ? [mapped] : [];
  });

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    unreadCount: unread.count ?? 0,
    nextCursor:
      hasMore && pageRows.length > 0
        ? encodeCursor(pageRows[pageRows.length - 1]?.created_at ?? "")
        : null,
    hasMore,
  };
}

/** Unread rows for the topbar bell. Row-level security scopes it to the caller. */
export async function countUnreadNotifications(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("notification_events")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) {
    throw new DataAccessError(
      "Could not count your unread notifications",
      error.code,
    );
  }

  return count ?? 0;
}

export async function markNotificationsRead(
  input: MarkNotificationsReadInput,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("mark_notification_events_read", {
    p_ids: input.all ? null : (input.ids ?? null),
  });

  if (error) {
    throw new DataAccessError(
      "Could not update your notifications",
      error.code,
    );
  }

  return data ?? 0;
}

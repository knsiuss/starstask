"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ConversationFilter } from "@/components/messages/message-search";
import type { ConversationRow } from "@/lib/db/direct-messages";

const PREVIEW_BY_FILTER = {
  all: () => true,
  unread: (c: ConversationRow) => c.unread,
  groups: (c: ConversationRow) => false,
} as const;

export function ConversationList({
  conversations,
}: {
  conversations: ConversationRow[];
}) {
  const [filter, setFilter] = useState<"all" | "unread" | "groups">("all");

  const filtered = useMemo(
    () => conversations.filter(PREVIEW_BY_FILTER[filter]),
    [conversations, filter],
  );

  if (conversations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center">
        <p className="text-4xl">💬</p>
        <p className="mt-3 font-medium">Belum ada chat</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Cari teman di atas buat mulai ngobrol terenkripsi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ConversationFilter onFilter={setFilter} />
      <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
        {filtered.map((conversation) => (
          <li key={conversation.id}>
            <Link
              href={`/messages/${conversation.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-white">
                {conversation.otherName.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">
                    {conversation.otherName}
                  </p>
                  {conversation.lastAt ? (
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {new Date(conversation.lastAt).toLocaleDateString(
                        "id-ID",
                        { day: "numeric", month: "short" },
                      )}
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  🔒 {conversation.lastMessage ?? "Encrypted"}
                </p>
              </div>
              {conversation.unread ? (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                  1
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Tidak ada chat di filter ini.
        </p>
      ) : null}
    </div>
  );
}

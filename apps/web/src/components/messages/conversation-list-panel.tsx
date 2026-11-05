"use client";

import { CircleUserRound, PencilLine, Plus, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { PresenceDot } from "@/components/messages/presence-dot";
import type { ConversationRow } from "@/lib/db/direct-messages";
import { formatRowTime, initials } from "@/lib/messages/format";
import { cn } from "@/lib/utils/cn";

const ROW_HEIGHT = 76;
const OVERSCAN = 6;

type Props = {
  conversations: ConversationRow[];
  selectedId: string | null;
  onlineIds: Set<string>;
  onSelect: (conversation: ConversationRow) => void;
  onCompose: () => void;
};

export function ConversationListPanel({
  conversations,
  selectedId,
  onlineIds,
  onSelect,
  onCompose,
}: Props) {
  const [query, setQuery] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.otherName.toLowerCase().includes(q));
  }, [conversations, query]);

  const stories = useMemo(
    () => (conversations ?? []).filter((c) => !c.isGroup).slice(0, 8),
    [conversations],
  );

  const total = filtered.length;
  const viewportHeight = 560;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    total,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN,
  );
  const visible = filtered.slice(startIndex, endIndex);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
        <button
          type="button"
          aria-label="New message"
          onClick={onCompose}
          className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <PencilLine
            aria-hidden="true"
            className="h-4 w-4"
          />
        </button>
      </div>

      <div className="px-5 pt-4">
        <label className="relative block">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search messages or people..."
            aria-label="Search messages or people"
            className="bg-muted/70 text-foreground placeholder:text-muted-foreground w-full rounded-full py-2.5 pr-9 pl-10 text-sm transition-colors focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
            >
              <X
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            </button>
          ) : null}
        </label>
      </div>

      {stories.length > 0 ? (
        <div className="px-5 pt-4">
          <ul
            className="no-scrollbar flex gap-4 overflow-x-auto pb-1"
            aria-label="Stories"
          >
            <li className="flex shrink-0 flex-col items-center">
              <button
                type="button"
                aria-label="Add your story"
                className="bg-accent-soft text-accent hover:bg-accent-soft/70 flex h-14 w-14 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <Plus
                  aria-hidden="true"
                  className="h-6 w-6"
                />
              </button>
              <span className="mt-1.5 text-xs">Your Story</span>
            </li>
            {stories.map((story) => (
              <li
                key={story.id}
                className="flex shrink-0 flex-col items-center"
              >
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent via-accent-hover to-band text-sm font-semibold text-white ring-2 ring-accent ring-offset-2 ring-offset-white">
                  <CircleUserRound
                    aria-hidden="true"
                    className="h-6 w-6 opacity-70"
                  />
                  <span className="absolute inset-0 flex items-center justify-center">
                    {initials(story.otherName)}
                  </span>
                  <PresenceDot online={onlineIds.has(story.otherUserId)} />
                </span>
                <span className="mt-1.5 max-w-16 truncate text-xs">
                  {story.otherName.split(" ")[0]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        ref={viewportRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-4"
        role="listbox"
        aria-label="Conversations"
      >
        {total === 0 ? (
          <p className="text-muted-foreground px-2 py-10 text-center text-sm">
            {query
              ? "No conversations match your search."
              : "No conversations yet."}
          </p>
        ) : (
          <div style={{ height: total * ROW_HEIGHT, position: "relative" }}>
            {visible.map((conversation, index) => {
              const rowIndex = startIndex + index;
              const active = conversation.id === selectedId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onSelect(conversation)}
                  style={{
                    transform: `translateY(${rowIndex * ROW_HEIGHT}px)`,
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: ROW_HEIGHT,
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                    active
                      ? "bg-accent-soft dark:bg-accent-soft/40"
                      : "hover:bg-muted/60",
                  )}
                >
                  <span className="relative shrink-0">
                    <span className="from-accent to-accent-hover flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white">
                      {initials(conversation.otherName)}
                    </span>
                    <PresenceDot
                      online={onlineIds.has(conversation.otherUserId)}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {conversation.otherName}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[11px]",
                          active
                            ? "text-accent dark:text-accent"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatRowTime(conversation.lastAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="text-muted-foreground truncate text-xs">
                        {conversation.lastMessage ?? "Encrypted"}
                      </span>
                      {conversation.unread ? (
                        <span className="bg-accent flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
                          1
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

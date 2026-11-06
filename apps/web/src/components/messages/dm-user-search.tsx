"use client";

import { ArrowLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { initials } from "@/lib/messages/format";
import type { ConversationRow } from "@/lib/db/direct-messages";

type User = {
  id: string;
  display_name: string;
};

type Props = {
  onClose?: () => void;
  onSelect?: (conversation: ConversationRow) => void;
};

export function DmUserSearch({ onClose, onSelect }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/dm/conversations?q=${encodeURIComponent(trimmed)}`,
        );
        const data = (await response.json()) as {
          users?: User[];
        };
        setUsers(data.users ?? []);
      } catch {
        setUsers([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const visibleUsers = query.trim().length < 2 ? [] : users;

  async function openChat(user: User): Promise<void> {
    setBusy(true);

    try {
      const response = await fetch("/api/dm/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: user.id }),
      });
      const data = (await response.json()) as { id?: string };

      if (data.id && onSelect) {
        onSelect({
          id: data.id,
          otherUserId: user.id,
          otherName: user.display_name,
          otherAvatarUrl: null,
          isGroup: false,
          participantNames: [],
          lastMessage: null,
          lastAt: null,
          unread: false,
          unreadCount: 0,
          isPinned: false,
          isMuted: false,
          isArchived: false,
        });
        return;
      }

      if (data.id) {
        router.push(`/messages/${data.id}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 px-5 pt-5">
        <button
          type="button"
          aria-label="Back to conversations"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ArrowLeft
            aria-hidden="true"
            className="h-5 w-5"
          />
        </button>
        <h1 className="text-xl font-semibold tracking-tight">New message</h1>
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
            autoComplete="off"
            autoFocus
            className="bg-muted/70 text-foreground placeholder:text-muted-foreground w-full rounded-full py-2.5 pr-4 pl-10 text-sm transition-colors focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>
        <p className="text-muted-foreground mt-2 text-xs">
          Type at least 2 characters to find a classmate.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-4">
        {visibleUsers.length > 0 ? (
          <ul
            role="listbox"
            aria-label="People"
          >
            {visibleUsers.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  disabled={busy}
                  onClick={() => void openChat(user)}
                  className="hover:bg-muted/70 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                >
                  <span className="from-accent to-accent-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white">
                    {initials(user.display_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {user.display_name}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      Tap to start a chat
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground px-3 py-10 text-center text-sm">
            {query.trim().length < 2
              ? "Search for people to message."
              : "No people found."}
          </p>
        )}
      </div>
    </div>
  );
}

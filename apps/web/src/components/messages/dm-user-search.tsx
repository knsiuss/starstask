"use client";

import { ArrowLeft, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { initials } from "@/lib/messages/format";
import type { ConversationRow } from "@/lib/db/direct-messages";

type User = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type Props = {
  onClose?: () => void;
  onSelect?: (conversation: ConversationRow) => void;
};

export function DmUserSearch({ onClose, onSelect }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return;
    }

    // AbortController cancels the previous in-flight search so fast
    // typing does not stack requests or render stale results.
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/dm/conversations?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as { users?: User[] };
        setUsers(data.users ?? []);
        setError(null);
      } catch (searchError) {
        if (
          searchError instanceof Error &&
          searchError.name === "AbortError"
        ) {
          return;
        }
        setUsers([]);
        setError("Could not search people. Try again.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const needsQuery = query.trim().length < 2;
  const visibleUsers = needsQuery ? [] : users;

  async function openChat(user: User): Promise<void> {
    setBusyId(user.id);

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
          otherAvatarUrl: user.avatar_url,
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
    } catch {
      setError("Could not open chat. Try again.");
    } finally {
      setBusyId(null);
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
            placeholder="Search by name..."
            aria-label="Search people by name"
            autoComplete="off"
            autoFocus
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
        <p className="text-muted-foreground mt-2 text-xs">
          Type at least 2 characters to find a classmate.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-4">
        {loading && visibleUsers.length === 0 ? (
          <ul
            className="space-y-1"
            aria-label="Searching"
          >
            {[0, 1, 2].map((index) => (
              <li
                key={index}
                className="flex items-center gap-3 px-3 py-3"
              >
                <span className="bg-muted h-11 w-11 shrink-0 animate-pulse rounded-full" />
                <span className="min-w-0 flex-1">
                  <span className="bg-muted block h-3.5 w-32 animate-pulse rounded" />
                  <span className="bg-muted mt-2 block h-3 w-20 animate-pulse rounded" />
                </span>
              </li>
            ))}
          </ul>
        ) : error ? (
          <p className="text-muted-foreground px-3 py-10 text-center text-sm">
            {error}
          </p>
        ) : visibleUsers.length > 0 ? (
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
                  disabled={busyId !== null}
                  onClick={() => void openChat(user)}
                  className="hover:bg-muted/70 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                >
                  {user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- user avatar URL
                    <img
                      src={user.avatar_url}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="from-accent to-accent-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white">
                      {initials(user.display_name)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {user.display_name}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {busyId === user.id
                        ? "Opening chat..."
                        : "Tap to start a chat"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground px-3 py-10 text-center text-sm">
            {needsQuery ? "Search for people to message." : "No people found."}
          </p>
        )}
      </div>
    </div>
  );
}

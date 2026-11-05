"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type User = {
  id: string;
  display_name: string;
};

export function DmUserSearch() {
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

  async function openChat(userId: string): Promise<void> {
    setBusy(true);

    try {
      const response = await fetch("/api/dm/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: userId }),
      });
      const data = (await response.json()) as { id?: string };

      if (data.id) {
        router.push(`/messages/${data.id}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <label
        htmlFor="dm-search"
        className="text-sm font-medium"
      >
        New message
      </label>
      <Input
        id="dm-search"
        className="mt-2"
        placeholder="Search by name (min 2 chars)…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
      />
      {visibleUsers.length > 0 ? (
        <ul className="mt-2 divide-y divide-border rounded-lg border">
          {visibleUsers.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between px-3 py-2"
            >
              <span className="text-sm">{user.display_name}</span>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void openChat(user.id)}
              >
                Chat
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

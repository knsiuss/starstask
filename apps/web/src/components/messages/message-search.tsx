"use client";

import { useState } from "react";

/** Search chat messages (plain text search on decrypted messages in UI). */
export function MessageSearch({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <input
      value={q}
      onChange={(e) => {
        setQ(e.target.value);
        onSearch(e.target.value);
      }}
      placeholder="Search in chat…"
      className="w-full rounded border px-2 py-1 text-sm"
    />
  );
}

/** Filter conversation list: All / Unread / Groups */
export function ConversationFilter({
  onFilter,
}: {
  onFilter: (f: "all" | "unread" | "groups") => void;
}) {
  return (
    <div className="flex gap-1">
      {(["all", "unread", "groups"] as const).map((f) => (
        <button
          key={f}
          type="button"
          className="rounded-full border px-2 py-1 text-xs capitalize"
          onClick={() => onFilter(f)}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

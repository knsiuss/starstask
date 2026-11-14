"use client";

import { Command, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils/cn";

type Item = { id: string; label: string; href: string };

const ITEMS: Item[] = [
  { id: "dashboard", label: "Go to Dashboard", href: "/app" },
  { id: "assignments", label: "Browse Assignments", href: "/assignments" },
  { id: "classes", label: "My Classes", href: "/classes" },
  { id: "attendance", label: "Attendance", href: "/attendance" },
  { id: "schedule", label: "Schedule", href: "/schedule" },
  { id: "messages", label: "Messages", href: "/messages" },
  { id: "notifications", label: "Notifications", href: "/notifications" },
  { id: "settings", label: "Settings", href: "/settings" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(
    () =>
      ITEMS.filter((item) =>
        item.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query],
  );

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="border-border bg-surface w-full max-w-lg overflow-hidden rounded-2xl border shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <label className="border-border flex items-center gap-2 border-b px-4">
          <Search
            aria-hidden="true"
            className="text-muted-foreground h-4 w-4 shrink-0"
          />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((i) => Math.min(i + 1, filtered.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              }
              if (event.key === "Enter" && filtered[index]) {
                go(filtered[index].href);
              }
            }}
            placeholder="Type a command or search..."
            aria-label="Command palette search"
            className="w-full bg-transparent py-3.5 text-sm focus-visible:outline-none"
          />
          <button
            type="button"
            aria-label="Close command palette"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground focus-visible:outline-accent -m-1 cursor-pointer rounded-md p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <X
              aria-hidden="true"
              className="h-4 w-4"
            />
          </button>
        </label>

        <ul
          className="max-h-80 overflow-y-auto p-2"
          role="listbox"
        >
          {filtered.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === index}
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(item.href)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  i === index
                    ? "bg-accent-soft text-accent"
                    : "hover:bg-muted/60",
                )}
              >
                <Command
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0"
                />
                {item.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="text-muted-foreground px-3 py-6 text-center text-sm">
              No matching command.
            </li>
          ) : null}
        </ul>

        <p className="text-muted-foreground border-t px-4 py-2 text-xs">
          <kbd className="font-sans">↑↓</kbd> navigate ·{" "}
          <kbd className="font-sans">Enter</kbd> open ·{" "}
          <kbd className="font-sans">Esc</kbd> close
        </p>
      </div>
    </div>
  );
}

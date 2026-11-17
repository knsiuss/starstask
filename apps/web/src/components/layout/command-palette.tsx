"use client";

import { Command, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";

type Item = { id: string; label: string; href: string };

const OPEN_COMMAND_PALETTE_EVENT = "starstask:open-command-palette";

const ITEMS: Item[] = [
  { id: "dashboard", label: "Go to Dashboard", href: "/app" },
  { id: "assignments", label: "Browse Assignments", href: "/assignments" },
  { id: "classes", label: "My Classes", href: "/classes" },
  { id: "attendance", label: "Attendance", href: "/attendance" },
  { id: "schedule", label: "Schedule", href: "/schedule" },
  { id: "leave-requests", label: "Absence Requests", href: "/leave-requests" },
  { id: "messages", label: "Messages", href: "/messages" },
  { id: "notifications", label: "Notifications", href: "/notifications" },
  { id: "settings", label: "Settings", href: "/settings/profile" },
];

export function CommandPaletteTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Open command palette"
      onClick={() =>
        window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))
      }
      className={cn(
        "border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-accent flex h-9 w-9 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        className,
      )}
    >
      <Search
        aria-hidden="true"
        className="h-4 w-4"
      />
    </button>
  );
}

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
    };
    const onOpen = () => setOpen(true);

    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  const filtered = useMemo(
    () =>
      ITEMS.filter((item) =>
        item.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query],
  );

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setIndex(0);
    }
  }, []);

  const go = useCallback(
    (href: string) => {
      handleOpenChange(false);
      router.push(href);
    },
    [handleOpenChange, router],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="top-[16%] max-w-lg translate-y-0 overflow-hidden rounded-xl p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>

        <label className="border-border flex items-center gap-2 border-b py-1 pr-12 pl-4">
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
            placeholder="Jump to a page..."
            aria-label="Command palette search"
            className="text-foreground placeholder:text-muted-foreground w-full bg-transparent py-3 text-sm focus-visible:outline-none"
          />
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
                  "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  i === index
                    ? "bg-accent-soft text-accent font-medium"
                    : "text-foreground hover:bg-muted/60",
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

        <p className="border-border text-muted-foreground hidden border-t px-4 py-2 text-xs sm:block">
          <kbd className="font-sans">↑↓</kbd> navigate ·{" "}
          <kbd className="font-sans">Enter</kbd> open ·{" "}
          <kbd className="font-sans">Esc</kbd> close
        </p>
      </DialogContent>
    </Dialog>
  );
}

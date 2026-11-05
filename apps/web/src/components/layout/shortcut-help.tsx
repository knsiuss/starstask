"use client";

import { Keyboard } from "lucide-react";
import { useEffect, useState } from "react";

const SHORTCUTS = [
  { keys: "Ctrl + K", action: "Open command palette" },
  { keys: "?", action: "Show keyboard shortcuts" },
  { keys: "Esc", action: "Close dialog" },
  { keys: "Enter", action: "Send message / confirm" },
  { keys: "Shift + Enter", action: "New line in composer" },
];

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "?" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Keyboard shortcuts"
        className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
      >
        <Keyboard aria-hidden="true" className="h-5 w-5" />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="border-border bg-surface w-full max-w-sm rounded-2xl border p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
            <dl className="mt-4 space-y-3">
              {SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <dt className="text-muted-foreground">{shortcut.action}</dt>
                  <dd>
                    <kbd className="border-border bg-muted rounded border px-1.5 py-0.5 font-sans text-xs">
                      {shortcut.keys}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="bg-accent hover:bg-accent-hover mt-5 w-full rounded-full py-2 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { Search } from "lucide-react";
import { useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";

/**
 * Top-bar assignment search. Submits through the same GET query as the
 * assignments page, so no extra client state or API is involved.
 */
export function GlobalSearch() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "k"
      ) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    window.addEventListener("keydown", focusSearch);

    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <form
      action="/assignments"
      method="get"
      role="search"
      className="relative w-full max-w-xl"
    >
      <label
        htmlFor="global-search"
        className="sr-only"
      >
        Search assignments
      </label>
      <Search
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
      />
      <Input
        ref={inputRef}
        id="global-search"
        name="search"
        type="search"
        maxLength={100}
        autoComplete="off"
        placeholder="Search assignments, courses, or keywords..."
        className="bg-background h-10 rounded-lg pr-20 pl-9"
      />
      <kbd
        aria-hidden="true"
        className="border-border bg-surface text-muted-foreground pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 items-center rounded border px-1.5 py-0.5 font-sans text-[11px] sm:flex"
      >
        Ctrl K
      </kbd>
    </form>
  );
}

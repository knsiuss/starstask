"use client";

import Link from "next/link";
import * as React from "react";

import { cn } from "@/lib/utils/cn";

export type TabStripItem = {
  href: string;
  label: string;
  active: boolean;
  icon?: React.ReactNode;
};

type TabStripProps = {
  /** Accessible name of the navigation landmark. */
  label: string;
  items: TabStripItem[];
  className?: string;
};

/**
 * Horizontal section navigation used by the class, course, manage, and
 * attendance workspaces.
 *
 * The strip scrolls on one axis only: `overflow-y` is declared hidden because a
 * lone `overflow-x: auto` makes the browser compute `overflow-y: auto`, which
 * paints a second scrollbar (and its arrow buttons) beside the tabs. The
 * scrollbar is hidden visually while swipe, drag, and keyboard focus still
 * scroll, and the active tab is kept in view.
 */
export function TabStrip({ label, items, className }: TabStripProps) {
  const listRef = React.useRef<HTMLUListElement>(null);
  const activeHref = items.find((item) => item.active)?.href;

  React.useEffect(() => {
    if (!activeHref) {
      return;
    }

    const active = listRef.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );

    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeHref]);

  return (
    <nav
      aria-label={label}
      className={cn(
        "border-border no-scrollbar overflow-x-auto overflow-y-hidden border-b",
        className,
      )}
    >
      <ul
        ref={listRef}
        className="flex min-w-max items-center gap-1"
      >
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "focus-visible:outline-accent inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                item.active
                  ? "border-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

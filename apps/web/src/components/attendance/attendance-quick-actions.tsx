"use client";

import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export type AttendanceQuickAction = {
  label: string;
  icon: LucideIcon;
  /** Navigates to another page. */
  href?: string;
  /** Opens a panel inside the workspace instead. */
  onSelect?: () => void;
};

type AttendanceQuickActionsProps = {
  actions: AttendanceQuickAction[];
  title?: string;
};

/**
 * Shortcut list for the workspace rail.
 *
 * Every entry either opens another page or pushes a panel onto the workspace
 * stack. An action without a destination is not rendered.
 */
export function AttendanceQuickActions({
  actions,
  title = "Quick actions",
}: AttendanceQuickActionsProps) {
  const usable = actions.filter(
    (action) => action.href !== undefined || action.onSelect !== undefined,
  );

  if (usable.length === 0) {
    return null;
  }

  return (
    <section className="border-border bg-surface overflow-hidden rounded-xl border">
      <h2 className="px-4 pt-4 pb-2 text-sm font-semibold tracking-tight">
        {title}
      </h2>
      <ul className="divide-border divide-y">
        {usable.map((action) => {
          const Icon = action.icon;
          const content = (
            <>
              <Icon
                aria-hidden="true"
                className="text-muted-foreground h-4 w-4 shrink-0"
              />
              <span className="min-w-0 flex-1 text-sm font-medium">
                {action.label}
              </span>
              <ChevronRight
                aria-hidden="true"
                className="text-muted-foreground h-4 w-4 shrink-0 transition group-hover:translate-x-0.5"
              />
            </>
          );

          const className =
            "group hover:bg-subtle focus-visible:outline-accent flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px]";

          return (
            <li key={action.label}>
              {action.href ? (
                <Link
                  href={action.href}
                  className={className}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={action.onSelect}
                  className={className}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

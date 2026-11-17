"use client";

import Link from "next/link";

import {
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  MessageCircle,
  Plus,
} from "lucide-react";

import { SectionHeader } from "@/components/dashboard/section-header";

const SECONDARY_ACTIONS = [
  {
    href: "/attendance",
    label: "Check in",
    icon: CalendarCheck,
  },
  {
    href: "/assignments",
    label: "Submit task",
    icon: ClipboardList,
  },
  {
    href: "/schedule",
    label: "Schedule",
    icon: CalendarDays,
  },
  {
    href: "/messages",
    label: "Messages",
    icon: MessageCircle,
  },
] as const;

export function QuickActions() {
  return (
    <section
      aria-labelledby="quick-actions-heading"
      className="border-border bg-surface rounded-xl border p-4"
    >
      <SectionHeader
        id="quick-actions-heading"
        title="Quick actions"
        density="rail"
      />

      <nav
        aria-label="Quick actions"
        className="mt-3 grid grid-cols-2 gap-2"
      >
        {SECONDARY_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="border-border bg-surface text-foreground hover:border-accent/40 hover:bg-hover hover:text-accent focus-visible:outline-accent flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <action.icon
              aria-hidden="true"
              className="text-muted-foreground h-4 w-4 shrink-0"
            />
            <span className="truncate">{action.label}</span>
          </Link>
        ))}

        <Link
          href="/submit"
          className="border-accent/25 bg-accent-soft/60 text-accent hover:bg-accent-soft focus-visible:outline-accent col-span-2 flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Plus
            aria-hidden="true"
            className="h-4 w-4 shrink-0"
          />
          <span>New assignment</span>
        </Link>
      </nav>
    </section>
  );
}

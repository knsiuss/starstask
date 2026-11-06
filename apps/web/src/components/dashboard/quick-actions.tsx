"use client";

import {
  CalendarCheck,
  ClipboardList,
  MessageCircle,
  Plus,
} from "lucide-react";
import Link from "next/link";

const ACTIONS = [
  {
    href: "/attendance",
    label: "Check in now",
    icon: CalendarCheck,
  },
  {
    href: "/assignments",
    label: "Submit task",
    icon: ClipboardList,
  },
  {
    href: "/schedule",
    label: "Today's schedule",
    icon: CalendarDaysIcon,
  },
  {
    href: "/messages",
    label: "Open messages",
    icon: MessageCircle,
  },
  {
    href: "/submit",
    label: "New assignment",
    icon: Plus,
  },
] as const;

function CalendarDaysIcon({ className }: { className?: string }) {
  return (
    <CalendarCheck
      aria-hidden="true"
      className={className}
    />
  );
}

export function QuickActions() {
  return (
    <nav
      aria-label="Quick actions"
      className="flex gap-2 overflow-x-auto pb-1"
    >
      {ACTIONS.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="glass-card flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95"
        >
          <span className="tile-cyan flex h-6 w-6 items-center justify-center rounded-lg text-white">
            <action.icon
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          </span>
          {action.label}
        </Link>
      ))}
    </nav>
  );
}

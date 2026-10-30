import {
  CalendarClock,
  CircleAlert,
  ClipboardList,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import type { DashboardStats } from "@/lib/db/dashboard";
import { cn } from "@/lib/utils/cn";
import { formatCount } from "@starstask/shared";

type StatTone = "accent" | "warning" | "danger" | "neutral";

type StatItem = {
  label: string;
  hint: string;
  value: number;
  icon: LucideIcon;
  tone: StatTone;
  href: string;
};

const TONE_CLASSES: Record<StatTone, string> = {
  accent: "bg-accent-soft text-accent",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-muted text-muted-foreground",
};

type StatCardsProps = {
  stats: DashboardStats;
};

export function StatCards({ stats }: StatCardsProps) {
  const items: StatItem[] = [
    {
      label: "Total tasks",
      hint: "Published in your classes",
      value: stats.totalTasks,
      icon: ClipboardList,
      tone: "accent",
      href: "/dashboard/assignments",
    },
    {
      label: "Due soon",
      hint: "Today through 7 days ahead",
      value: stats.dueSoon,
      icon: CalendarClock,
      tone: stats.dueSoon > 0 ? "warning" : "neutral",
      href: "/dashboard/assignments?due=soon",
    },
    {
      label: "Past deadline",
      hint: "Before today (WIB)",
      value: stats.pastDeadline,
      icon: CircleAlert,
      tone: stats.pastDeadline > 0 ? "danger" : "neutral",
      href: "/dashboard/assignments?due=overdue",
    },
    {
      label: "My classes",
      hint: "Active memberships",
      value: stats.classCount,
      icon: GraduationCap,
      tone: "accent",
      href: "/classes",
    },
  ];

  return (
    <ul className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.label}>
          <Link
            href={item.href}
            className="border-border bg-surface hover:border-accent/30 hover:bg-hover focus-visible:outline-accent group flex h-full flex-col rounded-xl border p-4 shadow-[0_1px_2px_rgba(9,9,11,0.03)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-5"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground text-[13px] font-medium">
                {item.label}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                  TONE_CLASSES[item.tone],
                )}
              >
                <item.icon className="h-4 w-4" />
              </span>
            </span>
            <span className="mt-2">
              <span className="text-foreground group-hover:text-accent block text-2xl font-semibold tracking-tight tabular-nums">
                {formatCount(item.value)}
              </span>
              <span className="text-muted-foreground mt-1 block text-[11px]">
                {item.hint}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

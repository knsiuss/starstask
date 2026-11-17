import Link from "next/link";

import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  GraduationCap,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

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
  delta?: number;
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
      label: "Total assignments",
      hint: "Across active classes",
      value: stats.totalTasks,
      icon: ClipboardList,
      tone: "accent",
      href: "/assignments",
      delta: stats.newThisWeek,
    },
    {
      label: "Due in 7 days",
      hint: stats.dueSoon > 0 ? "Upcoming deadlines" : "Nothing due soon",
      value: stats.dueSoon,
      icon: CalendarClock,
      tone: stats.dueSoon > 0 ? "warning" : "neutral",
      href: "/assignments?due=soon",
    },
    {
      label: "Past deadline",
      hint: stats.pastDeadline > 0 ? "Needs review" : "All on track",
      value: stats.pastDeadline,
      icon: TriangleAlert,
      tone: stats.pastDeadline > 0 ? "danger" : "neutral",
      href: "/assignments?due=overdue",
    },
    {
      label: "My classes",
      hint: "Active membership",
      value: stats.classCount,
      icon: GraduationCap,
      tone: "accent",
      href: "/classes",
    },
  ];

  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.label}>
          <Link
            href={item.href}
            className="border-border bg-surface hover:border-accent/40 hover:bg-hover/40 focus-visible:outline-accent group flex h-full flex-col justify-between gap-2.5 rounded-xl border px-3.5 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-4 sm:py-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground truncate text-xs font-medium">
                {item.label}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                  TONE_CLASSES[item.tone],
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
              </span>
            </div>

            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-foreground text-2xl leading-none font-semibold tracking-tight tabular-nums">
                    {formatCount(item.value)}
                  </span>
                  {item.delta && item.delta > 0 ? (
                    <span className="text-accent inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums">
                      <TrendingUp
                        aria-hidden="true"
                        className="h-3 w-3"
                      />
                      +{formatCount(item.delta)}
                    </span>
                  ) : null}
                </div>
                <span className="text-muted-foreground mt-1 block truncate text-[11px]">
                  {item.hint}
                </span>
              </div>

              <ArrowRight
                aria-hidden="true"
                className="text-muted-foreground/70 group-hover:text-accent h-3.5 w-3.5 shrink-0 transition-colors"
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

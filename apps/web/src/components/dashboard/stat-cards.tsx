import type { CSSProperties } from "react";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  GraduationCap,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import type { DashboardStats } from "@/lib/db/dashboard";
import { cn } from "@/lib/utils/cn";
import { formatCount } from "@starstask/shared";

type StatTone = "accent" | "warning" | "danger" | "success";

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
  success: "bg-success-soft text-success",
};

type StatCardsProps = {
  stats: DashboardStats;
};

export function StatCards({ stats }: StatCardsProps) {
  const items: StatItem[] = [
    {
      label: "Total assignments",
      hint: "In your classes",
      value: stats.totalTasks,
      icon: ClipboardList,
      tone: "accent",
      href: "/dashboard/assignments",
      delta: stats.newThisWeek,
    },
    {
      label: "Due soon",
      hint: "Within the next 7 days",
      value: stats.dueSoon,
      icon: CalendarClock,
      tone: "warning",
      href: "/dashboard/assignments?due=soon",
    },
    {
      label: "Past deadline",
      hint: "Needs your attention",
      value: stats.pastDeadline,
      icon: TriangleAlert,
      tone: "danger",
      href: "/dashboard/assignments?due=overdue",
    },
    {
      label: "My classes",
      hint: "Active membership",
      value: stats.classCount,
      icon: GraduationCap,
      tone: "success",
      href: "/classes",
    },
  ];

  return (
    <ul
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      style={{ "--rise-delay": "40ms" } as CSSProperties}
    >
      {items.map((item) => (
        <li key={item.label}>
          <Link
            href={item.href}
            className="border-border bg-surface hover:border-accent/30 focus-visible:outline-accent group flex h-full items-start gap-3 rounded-xl border p-4 shadow-[0_1px_2px_rgba(9,9,11,0.03)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                TONE_CLASSES[item.tone],
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="text-muted-foreground block text-[12px] font-medium">
                {item.label}
              </span>
              <span className="mt-1 flex items-baseline gap-2">
                <span className="text-foreground text-[26px] leading-none font-semibold tracking-tight tabular-nums">
                  {formatCount(item.value)}
                </span>
                {item.delta && item.delta > 0 ? (
                  <span className="text-success inline-flex items-center gap-0.5 text-[11px] font-semibold">
                    <TrendingUp
                      aria-hidden="true"
                      className="h-3 w-3"
                    />
                    +{formatCount(item.delta)}
                  </span>
                ) : null}
              </span>
              <span className="text-muted-foreground mt-1.5 block truncate text-[11px]">
                {item.hint}
              </span>
            </span>

            <span
              aria-hidden="true"
              className="border-border text-muted-foreground group-hover:border-accent/30 group-hover:text-accent mt-6 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors"
            >
              <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

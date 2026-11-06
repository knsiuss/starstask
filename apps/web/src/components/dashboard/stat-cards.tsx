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
  accent: "tile-blue text-white",
  warning: "tile-amber text-white",
  danger: "tile-rose text-white",
  success: "tile-emerald text-white",
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
      href: "/assignments",
      delta: stats.newThisWeek,
    },
    {
      label: "Due soon",
      hint: "Within the next 7 days",
      value: stats.dueSoon,
      icon: CalendarClock,
      tone: "warning",
      href: "/assignments?due=soon",
    },
    {
      label: "Past deadline",
      hint: "Needs your attention",
      value: stats.pastDeadline,
      icon: TriangleAlert,
      tone: "danger",
      href: "/assignments?due=overdue",
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
      className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4"
      style={{ "--rise-delay": "40ms" } as CSSProperties}
    >
      {items.map((item) => (
        <li key={item.label}>
          <Link
            href={item.href}
            className="glass-card group flex h-full items-center gap-2.5 rounded-2xl p-3 transition-colors focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2 sm:gap-3 sm:p-4"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11",
                TONE_CLASSES[item.tone],
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="text-muted-foreground block truncate text-xs font-medium">
                {item.label}
              </span>
              <span className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-foreground text-[22px] leading-none font-semibold tracking-tight tabular-nums sm:text-[26px]">
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
              <span className="text-muted-foreground mt-1 hidden truncate text-[11px] sm:block">
                {item.hint}
              </span>
            </span>

            <span
              aria-hidden="true"
              className="border-border text-muted-foreground group-hover:border-accent/30 group-hover:text-accent mt-6 hidden h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors sm:flex"
            >
              <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import {
  ArrowRight,
  BookOpenText,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileWarning,
  GraduationCap,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import {
  type ActionCenterRow,
  type ActionCounts,
} from "@/lib/classes/action-center";
import { cn } from "@/lib/utils/cn";
import { pluralize } from "@starstask/shared";

type AttentionMetric = {
  key: keyof ActionCounts;
  label: string;
  hint: string;
  icon: LucideIcon;
  href: string;
  tone: "accent" | "warning" | "success" | "danger";
};

const ATTENTION_METRICS: readonly AttentionMetric[] = [
  {
    key: "pendingSubmissions",
    label: "Submissions to review",
    hint: "Waiting on your grade",
    icon: ClipboardCheck,
    href: "/app/actions?tab=assignments",
    tone: "accent",
  },
  {
    key: "pendingLeave",
    label: "Absence requests",
    hint: "Forwarded by your class",
    icon: ClipboardList,
    href: "/app/actions?tab=absences",
    tone: "warning",
  },
  {
    key: "todaysSessions",
    label: "Sessions today",
    hint: "Scheduled class meetings",
    icon: CalendarClock,
    href: "/app/actions?tab=attendance",
    tone: "success",
  },
  {
    key: "openReports",
    label: "Reader reports",
    hint: "Flagged submissions",
    icon: FileWarning,
    href: "/app/actions",
    tone: "danger",
  },
];

const TONE_CLASSES: Record<AttentionMetric["tone"], string> = {
  accent: "bg-accent-soft text-accent",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
};

const CARD_SURFACE =
  "border-border bg-surface hover:border-accent/30 focus-visible:outline-accent group flex h-full items-center rounded-xl border p-3 shadow-[0_1px_2px_rgba(9,9,11,0.03)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-4";

/** The four counters a lecturer checks before anything else. */
export function TeachingAttention({ totals }: { totals: ActionCounts }) {
  const waitingTotal =
    totals.pendingSubmissions + totals.pendingLeave + totals.openReports;

  return (
    <section
      aria-labelledby="teaching-attention"
      className="mt-7"
    >
      <div className="flex items-end justify-between gap-3">
        <h2
          id="teaching-attention"
          className="text-lg font-semibold tracking-tight"
        >
          Needs your attention
        </h2>
        <p className="text-muted-foreground text-xs">
          {waitingTotal === 0
            ? "Nothing waiting"
            : `${waitingTotal} ${pluralize(waitingTotal, "item")} open`}
        </p>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {ATTENTION_METRICS.map((metric) => {
          const value = totals[metric.key];

          return (
            <li key={metric.key}>
              <Link
                href={metric.href}
                className={cn(CARD_SURFACE, "stat-shimmer gap-2.5 sm:gap-3")}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10",
                    TONE_CLASSES[metric.tone],
                  )}
                >
                  <metric.icon className="h-[18px] w-[18px]" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="text-muted-foreground block truncate text-xs font-medium">
                    {metric.label}
                  </span>
                  <span className="text-foreground mt-0.5 block text-[22px] leading-none font-semibold tabular-nums tracking-tight sm:text-[26px]">
                    {value}
                  </span>
                  <span className="text-muted-foreground mt-1 hidden truncate text-[11px] sm:block">
                    {value === 0 ? "Clear" : metric.hint}
                  </span>
                </span>

                <ArrowRight
                  aria-hidden="true"
                  className="text-muted-foreground group-hover:text-accent hidden h-4 w-4 shrink-0 transition-colors sm:block"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Classes with a scheduled meeting today, linking straight to that list. */
export function TeachingToday({ rows }: { rows: ActionCenterRow[] }) {
  const sessions = rows.filter((row) => row.todaysSessions > 0);

  return (
    <section aria-labelledby="teaching-today">
      <h2
        id="teaching-today"
        className="text-lg font-semibold tracking-tight"
      >
        Today&rsquo;s teaching
      </h2>

      {sessions.length === 0 ? (
        <Card className="mt-3 flex items-center gap-3 border-dashed">
          <CalendarClock
            aria-hidden="true"
            className="text-muted-foreground h-5 w-5 shrink-0"
          />
          <p className="text-muted-foreground text-sm">
            No class sessions are scheduled for today.
          </p>
        </Card>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {sessions.map((row) => (
            <li key={row.classId}>
              <Link
                href={`/app/classes/${row.classSlug}/sessions`}
                className="border-border bg-surface hover:border-accent/30 focus-visible:outline-accent flex items-center gap-3 rounded-lg border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span className="bg-success-soft text-success flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                  <CalendarClock
                    aria-hidden="true"
                    className="h-[18px] w-[18px]"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {row.className}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    {row.todaysSessions}{" "}
                    {pluralize(row.todaysSessions, "session")} scheduled
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="text-muted-foreground h-4 w-4 shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Shortcut = {
  href: string;
  icon: LucideIcon;
  label: string;
  detail: string;
};

const SHORTCUTS: readonly Shortcut[] = [
  {
    href: "/app/actions",
    icon: ListChecks,
    label: "Action center",
    detail: "Review queues across every class",
  },
  {
    href: "/classes",
    icon: GraduationCap,
    label: "Class roster",
    detail: "Members, invitations, and settings",
  },
  {
    href: "/attendance",
    icon: ClipboardCheck,
    label: "Attendance",
    detail: "Meetings and check-in records",
  },
  {
    href: "/app?view=student",
    icon: BookOpenText,
    label: "Student view",
    detail: "Your own enrolled classes",
  },
];

/** Four one-tap destinations, including the escape hatch to the student view. */
export function TeachingShortcuts() {
  return (
    <section aria-labelledby="teaching-quick">
      <h2
        id="teaching-quick"
        className="text-lg font-semibold tracking-tight"
      >
        Teaching shortcuts
      </h2>
      <Card className="mt-3 p-2">
        <ul className="divide-border divide-y">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.href}>
              <Link
                href={shortcut.href}
                className="hover:bg-muted focus-visible:outline-accent group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                  <shortcut.icon
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {shortcut.label}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {shortcut.detail}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="text-muted-foreground group-hover:text-accent h-4 w-4 shrink-0 transition-colors"
                />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

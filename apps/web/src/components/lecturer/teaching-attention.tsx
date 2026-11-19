import {
  ArrowRight,
  BellRing,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileWarning,
  ExternalLink,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { type ActionCounts } from "@/lib/classes/action-center";
import type { LecturerToday, LecturerTodaySession } from "@/lib/lecturer-today";
import { cn } from "@/lib/utils/cn";
import { pluralize } from "@starstask/shared";

/** Light tokens remap to existing theme variables; dark tokens are the lecturer navy. */
const PANEL =
  "border-border bg-surface text-foreground dark:border-white/[0.06] dark:bg-[#23231f] dark:text-[#ece9e3]";
const MUTED_TEXT = "text-muted-foreground dark:text-[#aaa69e]";
const DIVIDER = "divide-border dark:divide-white/[0.06]";

type AttentionMetric = {
  key: keyof ActionCounts;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const ATTENTION_METRICS: readonly AttentionMetric[] = [
  {
    key: "pendingSubmissions",
    label: "Submissions to review",
    description: "Student submissions waiting for your review",
    href: "/actions?tab=assignments",
    icon: ClipboardCheck,
  },
  {
    key: "pendingLeave",
    label: "Absence requests",
    description: "Absence requests awaiting your approval",
    href: "/actions?tab=absences",
    icon: ClipboardList,
  },
  {
    key: "todaysSessions",
    label: "Sessions today",
    description: "Meetings scheduled for today",
    href: "/actions?tab=attendance",
    icon: CalendarClock,
  },
  {
    key: "openReports",
    label: "Reports to review",
    description: "Open reader reports from your classes",
    href: "/actions",
    icon: FileWarning,
  },
];

type TeachingAttentionProps = {
  totals: ActionCounts;
};

/**
 * Attention list: one row per counter a lecturer checks first.
 * Zero counts stay muted; non-zero counts carry accent emphasis.
 */
export function TeachingAttention({ totals }: TeachingAttentionProps) {
  const waitingTotal =
    totals.pendingSubmissions + totals.pendingLeave + totals.openReports;

  return (
    <section
      aria-labelledby="teaching-attention"
      className={cn("flex h-full flex-col rounded-xl border p-4 sm:p-5", PANEL)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="teaching-attention"
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <BellRing
            aria-hidden="true"
            className="h-4 w-4 text-[#b45309] dark:text-[#d9a441]"
          />
          Needs your attention
        </h2>
        <Link
          href="/actions"
          className="text-accent focus-visible:outline-accent inline-flex items-center gap-1 rounded-sm text-xs font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-[#c3ccad]"
        >
          {waitingTotal === 0
            ? "All clear"
            : `${waitingTotal} ${pluralize(waitingTotal, "item")} open`}
          <ArrowRight
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </Link>
      </div>

      <ul
        className={cn(
          "border-border divide-y border-t border-b sm:rounded-lg sm:border",
          DIVIDER,
          "dark:border-white/[0.06]",
          "mt-3 flex-1",
        )}
      >
        {ATTENTION_METRICS.map((metric) => {
          const value = totals[metric.key];

          return (
            <AttentionRow
              key={metric.key}
              icon={metric.icon}
              label={metric.label}
              description={metric.description}
              href={metric.href}
              count={value}
            />
          );
        })}
      </ul>
    </section>
  );
}

function AttentionRow({
  icon: Icon,
  label,
  description,
  href,
  count,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  href: string;
  count: number;
}) {
  const hasItems = count > 0;

  return (
    <li>
      <Link
        href={href}
        className="focus-visible:outline-accent group flex items-center gap-3 px-1 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] hover:bg-muted/40 sm:px-3 dark:hover:bg-white/[0.04]"
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            hasItems
              ? "bg-[#5b6b45] text-white"
              : "bg-muted text-muted-foreground dark:bg-white/[0.06] dark:text-[#a19d92]",
          )}
        >
          <Icon
            aria-hidden="true"
            className="h-4 w-4"
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-sm font-medium dark:text-[#ece9e3]">
            {label}
          </span>
          <span className={cn("mt-0.5 block truncate text-xs", MUTED_TEXT)}>
            {description}
          </span>
        </span>

        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
            hasItems
              ? "border-[#f5c15d]/30 bg-[#f5c15d]/15 text-[#92600f] dark:border-[#f5c15d]/25 dark:bg-[#f5c15d]/10 dark:text-[#e8b84b]"
              : "border-border bg-muted text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#a19d92]",
          )}
        >
          {count}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 dark:text-[#a19d92]"
        />
      </Link>
    </li>
  );
}

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Jakarta",
});

function formatTimeRange(startsAtIso: string, endsAtIso: string): string {
  const start = new Date(startsAtIso);
  const end = new Date(endsAtIso);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Time unavailable";
  }

  return `${timeFormatter.format(start)} – ${timeFormatter.format(end)}`;
}

/** Today's teaching sessions for the classes the caller administers. */
export function TeachingToday({ today }: { today: LecturerToday | null }) {
  return (
    <section
      aria-labelledby="teaching-today"
      className={cn("flex h-full flex-col rounded-xl border p-4 sm:p-5", PANEL)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="teaching-today"
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <CalendarClock
            aria-hidden="true"
            className="h-4 w-4 text-[#5b6b45] dark:text-[#a3b07d]"
          />
          Today&rsquo;s teaching
        </h2>
        <Link
          href="/schedule"
          className="text-accent focus-visible:outline-accent inline-flex items-center gap-1 rounded-sm text-xs font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-[#c3ccad]"
        >
          View schedule
          <ArrowRight
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </Link>
      </div>

      {today === null ? (
        <Alert
          variant="error"
          className="mt-3"
        >
          Could not load today&rsquo;s sessions. Try again in a moment.
        </Alert>
      ) : today.sessions.length === 0 ? (
        <div className="border-border mt-3 flex flex-1 items-center gap-3 rounded-xl border border-dashed px-4 py-6 dark:border-white/[0.1]">
          <CalendarClock
            aria-hidden="true"
            className={cn("h-5 w-5 shrink-0", MUTED_TEXT)}
          />
          <p className={cn("text-sm", MUTED_TEXT)}>
            No sessions scheduled today.
          </p>
        </div>
      ) : (
        <ol className="mt-3 flex-1">
          {today.sessions.map((session, index) => (
            <TodayTimelineRow
              key={session.id}
              session={session}
              isLast={index === today.sessions.length - 1}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function TodayTimelineRow({
  session,
  isLast,
}: {
  session: LecturerTodaySession;
  isLast: boolean;
}) {
  const isCompleted = session.status === "completed";
  const isCancelled = session.status === "cancelled";
  const code = session.classCode ?? session.classSlug;

  return (
    <li className="relative flex gap-3 pb-5 last:pb-1">
      {!isLast ? (
        <span
          aria-hidden="true"
          className="bg-border absolute top-5 left-[7px] h-[calc(100%-1rem)] w-px dark:bg-white/[0.1]"
        />
      ) : null}
      <span
        aria-hidden="true"
        className={cn(
          "relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2",
          isCompleted &&
            "border-success bg-success dark:border-[#5cb98a] dark:bg-[#5cb98a]",
          isCancelled &&
            "border-muted-foreground/40 bg-transparent dark:border-[#4e4e45]",
          !isCompleted &&
            !isCancelled &&
            "border-[#5b6b45] bg-[#5b6b45] dark:border-[#6f7f52] dark:bg-[#6f7f52]",
        )}
      />

      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-xs tabular-nums", MUTED_TEXT)}>
              {formatTimeRange(session.startsAtIso, session.endsAtIso)}
            </span>
            {code ? (
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] dark:bg-white/[0.06] dark:text-[#b6b2a7]">
                {code}
              </span>
            ) : null}
          </div>

          <p className="text-foreground mt-1 truncate text-sm font-semibold dark:text-[#ece9e3]">
            {session.className}
          </p>
          <p className={cn("truncate text-xs", MUTED_TEXT)}>{session.title}</p>

          {session.sessionType === "in_person" && session.location ? (
            <p
              className={cn(
                "mt-1 inline-flex max-w-full items-center gap-1 text-[11px]",
                MUTED_TEXT,
              )}
            >
              <MapPin
                aria-hidden="true"
                className="h-3 w-3 shrink-0"
              />
              <span className="truncate">{session.location}</span>
            </p>
          ) : null}
          {session.sessionType === "online" && session.meetingUrl ? (
            <a
              href={session.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent focus-visible:outline-accent mt-1 inline-flex max-w-full items-center gap-1 rounded-sm text-[11px] font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-[#c3ccad]"
            >
              <ExternalLink
                aria-hidden="true"
                className="h-3 w-3 shrink-0"
              />
              <span className="truncate">Join online meeting</span>
            </a>
          ) : null}
        </div>

        <SessionAction session={session} />
      </div>
    </li>
  );
}

function SessionAction({ session }: { session: LecturerTodaySession }) {
  if (session.status === "completed") {
    return (
      <span className="border-success/30 bg-success-soft text-success inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold dark:border-[#5cb98a]/30 dark:bg-[#5cb98a]/10 dark:text-[#5cb98a]">
        Completed
      </span>
    );
  }

  if (session.status === "cancelled") {
    return (
      <span className="border-border bg-muted text-muted-foreground inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#a19d92]">
        Cancelled
      </span>
    );
  }

  return (
    <Link
      href={`/sessions/${session.id}`}
      className="focus-visible:outline-accent inline-flex shrink-0 items-center rounded-full border border-transparent bg-[#5b6b45] px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#4a5838] focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      Open class
    </Link>
  );
}

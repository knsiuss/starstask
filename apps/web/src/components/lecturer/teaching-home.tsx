import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ClipboardCheck,
  GraduationCap,
  ListChecks,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import {
  TeachingAttention,
  TeachingToday,
} from "@/components/lecturer/teaching-attention";
import { TeachingBapProgress } from "@/components/lecturer/teaching-bap-progress";
import { TeachingClasses } from "@/components/lecturer/teaching-classes";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { type ActionCenterRow } from "@/lib/classes/action-center";
import { getClassActionCenter } from "@/lib/db/class-actions";
import { getLecturerOverview } from "@/lib/db/lecturer";
import { getLecturerBapProgress } from "@/lib/db/lecturer-bap";
import type { LecturerToday } from "@/lib/lecturer-today";
import { cn } from "@/lib/utils/cn";
import { pluralize } from "@starstask/shared";

type TeachingHomeProps = {
  userId: string;
  displayName: string;
  userEmail: string | null;
  today: LecturerToday | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

const jakartaHourFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Jakarta",
});

function greetingForJakartaHour(hour: number): string {
  if (hour >= 5 && hour < 11) return "Good morning";
  if (hour >= 11 && hour < 15) return "Good afternoon";
  if (hour >= 15 && hour < 19) return "Good evening";
  return "Good evening";
}

function firstName(displayName: string): string {
  const [first] = displayName.trim().split(/\s+/);
  return first && first.length > 0 ? first : "there";
}

/**
 * Teaching console shown at `/lecturer` for verified lecturers.
 *
 * The root panel carries the lecturer navy surface in dark mode only; light
 * mode keeps the existing neutral theme so the rest of the workspace is
 * untouched.
 */
export async function TeachingHome({
  userId,
  displayName,
  today,
}: TeachingHomeProps) {
  const [overview, actionCenter, bapSummary] = await Promise.all([
    getLecturerOverview(userId).catch(() => null),
    getClassActionCenter(userId).catch(() => null),
    getLecturerBapProgress(userId).catch(() => null),
  ]);

  if (!overview) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Alert variant="error">
          Could not load your teaching workspace. Try again in a moment.
        </Alert>
      </div>
    );
  }

  const rows = actionCenter?.rows ?? [];
  const rowsByClassId = new Map<string, ActionCenterRow>(
    rows.map((row) => [row.classId, row]),
  );
  const hasClasses = overview.classes.length > 0;
  const jakartaHour = Number.parseInt(
    jakartaHourFormatter.format(new Date()),
    10,
  );
  const greeting = greetingForJakartaHour(
    Number.isFinite(jakartaHour) ? jakartaHour : 0,
  );
  const sessionsToday =
    today?.sessions.length ?? actionCenter?.totals.todaysSessions ?? 0;

  const bapByClassId = new Map<string, number>(
    (bapSummary?.offerings ?? []).map((offering) => [
      offering.classId,
      offering.progressPercent,
    ]),
  );

  return (
    <div className="bg-background text-foreground relative overflow-hidden dark:bg-[#1a1a17] dark:text-[#ece9e3]">
      {/* Soft ambient wash, purely decorative; sits behind the console. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-[420px] dark:block"
        style={{
          background:
            "radial-gradient(900px 460px at 80% -12%, rgba(163,176,125,0.14), transparent 60%), radial-gradient(700px 380px at 12% -6%, rgba(196,154,92,0.10), transparent 55%)",
        }}
      />
      <div className="relative mx-auto w-full px-5 pt-7 pb-12 sm:px-8 sm:py-9 lg:px-10 2xl:px-14">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-white/[0.06]">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase dark:text-[#a19d92]">
              Teaching console
              <span aria-hidden="true"> · </span>
              {overview.classCount} {pluralize(overview.classCount, "class")}
              <span aria-hidden="true"> · </span>
              {overview.memberCount} {pluralize(overview.memberCount, "member")}
            </p>
            <h1 className="mt-2 text-[1.65rem] leading-[1.15] font-semibold tracking-tight sm:text-4xl lg:text-[2.4rem] dark:text-[#ece9e3]">
              {greeting}, {firstName(displayName)}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed dark:text-[#aaa69e]">
              Here&rsquo;s what&rsquo;s happening with your teaching today.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="focus-visible:outline-accent inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#ece9e3]">
              <Calendar
                aria-hidden="true"
                className="h-4 w-4 text-[#5b6b45] dark:text-[#a3b07d]"
              />
              {dateFormatter.format(new Date())}
            </div>
            <Link
              href="/app?view=student"
              className="text-muted-foreground hover:text-foreground focus-visible:outline-accent inline-flex items-center gap-1 rounded-sm text-xs font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-[#a19d92] dark:hover:text-[#ece9e3]"
            >
              Student view
              <ArrowRight
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            </Link>
            <Button
              asChild
              size="sm"
              className="dark:bg-[#5b6b45] dark:text-white dark:hover:bg-[#4a5838]"
            >
              <Link href="/actions">
                <ListChecks
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Action center
              </Link>
            </Button>
          </div>
        </header>

        {!hasClasses ? (
          <div className="px-2 py-16 text-center">
            <p className="text-foreground text-sm font-medium dark:text-[#ece9e3]">
              No teaching classes yet
            </p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed dark:text-[#aaa69e]">
              Create a class, import your teaching schedule / KRS, or join an
              existing class with an invitation code.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button
                asChild
                size="sm"
              >
                <Link href="/classes/create">Create class</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="secondary"
              >
                <Link href="/classes/create?tab=krs">
                  Import KRS / Schedule
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="secondary"
              >
                <Link href="/classes/join">Join a class</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <StatTiles
              classCount={overview.classCount}
              memberCount={overview.memberCount}
              pendingReviews={actionCenter?.totals.pendingSubmissions ?? 0}
              pendingReviewsAvailable={actionCenter !== null}
              sessionsToday={sessionsToday}
              sessionsTodayAvailable={today !== null || actionCenter !== null}
            />

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              {actionCenter ? (
                <TeachingAttention totals={actionCenter.totals} />
              ) : (
                <Alert
                  variant="error"
                  className="mt-1"
                >
                  Could not load your action center counts. Try again in a
                  moment.
                </Alert>
              )}

              <TeachingToday today={today} />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
              <TeachingClasses
                classes={overview.classes}
                rowsByClassId={rowsByClassId}
                actionCenterUnavailable={!actionCenter}
                progressByClassId={bapByClassId}
              />
              <TeachingBapProgress summary={bapSummary} />
            </div>
          </>
        )}

        <p className="text-muted-foreground mt-10 max-w-2xl text-[11px] leading-relaxed dark:text-[#a19d92]">
          StarsTask is not your university&rsquo;s official system. Attendance
          and grades recorded here are working notes; the official record stays
          on your university&rsquo;s own systems after you verify it there.
        </p>
      </div>
    </div>
  );
}

type StatTile = {
  key: string;
  label: string;
  value: number | null;
  subCaption: string | null;
  href: string;
  icon: LucideIcon;
};

function StatTiles({
  classCount,
  memberCount,
  pendingReviews,
  pendingReviewsAvailable,
  sessionsToday,
  sessionsTodayAvailable,
}: {
  classCount: number;
  memberCount: number;
  pendingReviews: number;
  pendingReviewsAvailable: boolean;
  sessionsToday: number;
  sessionsTodayAvailable: boolean;
}) {
  const tiles: readonly StatTile[] = [
    {
      key: "active-classes",
      label: "Active classes",
      value: classCount,
      subCaption: "Across all classes",
      href: "/classes",
      icon: GraduationCap,
    },
    {
      key: "total-students",
      label: "Total students",
      value: memberCount,
      subCaption: "Across all classes",
      href: "/classes",
      icon: Users,
    },
    {
      key: "pending-reviews",
      label: "Pending reviews",
      value: pendingReviewsAvailable ? pendingReviews : null,
      subCaption: pendingReviewsAvailable ? "Across all classes" : null,
      href: "/actions?tab=assignments",
      icon: ClipboardCheck,
    },
    {
      key: "sessions-today",
      label: "Sessions today",
      value: sessionsTodayAvailable ? sessionsToday : null,
      subCaption: sessionsTodayAvailable ? "Scheduled for today" : null,
      href: "/actions?tab=attendance",
      icon: CalendarClock,
    },
  ];

  return (
    <ul className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {tiles.map((tile) => (
        <StatTileCard
          key={tile.key}
          tile={tile}
        />
      ))}
    </ul>
  );
}

function StatTileCard({ tile }: { tile: StatTile }) {
  const Icon = tile.icon;
  const hasValue = tile.value !== null;

  return (
    <li>
      <Link
        href={tile.href}
        className="group border-border hover:border-border/80 focus-visible:outline-accent flex h-full flex-col gap-2 rounded-xl border p-3 transition-[border-color,transform] focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-4 dark:border-white/[0.06] dark:bg-[#23231f] dark:hover:border-white/[0.12]"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5b6b45] text-white ring-1 ring-inset ring-white/10 dark:bg-[#2e3324] dark:text-[#c3ccad] dark:ring-white/[0.08]">
            <Icon
              aria-hidden="true"
              className="h-5 w-5"
            />
          </span>
          <ArrowUpRight
            aria-hidden="true"
            className="text-muted-foreground h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-[#a19d92]"
          />
        </span>

        <span className="text-muted-foreground block text-[11px] font-medium tracking-[0.06em] uppercase dark:text-[#aaa69e]">
          {tile.label}
        </span>
        <span
          className={cn(
            "text-[1.75rem] leading-none font-semibold tabular-nums tracking-tight sm:text-[2rem]",
            hasValue
              ? "text-foreground dark:text-[#ece9e3]"
              : "text-muted-foreground/60 dark:text-[#4e4e45]",
          )}
        >
          {hasValue ? tile.value : "—"}
        </span>
        {tile.subCaption ? (
          <span className="text-muted-foreground mt-auto block text-[11px] leading-snug dark:text-[#a19d92]">
            {tile.subCaption}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileWarning,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import {
  type ActionCenterRow,
  type ActionCenterTotals,
  type ActionCounts,
} from "@/lib/classes/action-center";
import { getClassActionCenter } from "@/lib/db/class-actions";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Action center",
  description: "Everything waiting on you across the classes you lead.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type MetricKey = keyof ActionCounts;

type Metric = {
  key: MetricKey;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  path: (slug: string) => string;
};

const METRICS: readonly Metric[] = [
  {
    key: "pendingSubmissions",
    label: "Submissions to review",
    shortLabel: "Submissions",
    icon: ClipboardCheck,
    path: (slug) =>
      `/dashboard/classes/${slug}/manage?tab=content&status=pending_review#review-queue`,
  },
  {
    key: "pendingLeave",
    label: "Absence requests",
    shortLabel: "Absences",
    icon: ClipboardList,
    path: (slug) => `/dashboard/classes/${slug}/leave-requests`,
  },
  {
    key: "todaysSessions",
    label: "Sessions today",
    shortLabel: "Sessions",
    icon: CalendarClock,
    path: (slug) => `/dashboard/classes/${slug}/sessions`,
  },
  {
    key: "openReports",
    label: "Open reader reports",
    shortLabel: "Reports",
    icon: FileWarning,
    path: (slug) => `/dashboard/classes/${slug}/reports`,
  },
];

const TOTAL_METRICS: readonly {
  key: MetricKey;
  label: string;
  icon: LucideIcon;
}[] = [
  {
    key: "pendingSubmissions",
    label: "Submissions to review",
    icon: ClipboardCheck,
  },
  { key: "pendingLeave", label: "Absence requests", icon: ClipboardList },
  { key: "todaysSessions", label: "Sessions today", icon: CalendarClock },
  { key: "openReports", label: "Open reader reports", icon: FileWarning },
];

function buildSummary(totals: ActionCenterTotals): string {
  if (totals.actions === 0) {
    return "Nothing is waiting on you right now.";
  }

  const classLabel = totals.classes === 1 ? "class" : "classes";

  return `${totals.actions} ${totals.actions === 1 ? "action" : "actions"} across ${totals.classes} ${classLabel}.`;
}

function ClassActionsCard({ row }: { row: ActionCenterRow }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{row.className}</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {row.semester} · {row.academicYear}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            row.total > 0
              ? "bg-warning-soft text-warning"
              : "bg-muted text-muted-foreground",
          )}
        >
          {row.total} {row.total === 1 ? "action" : "actions"}
        </span>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {METRICS.map((metric) => {
          const value = row[metric.key];
          const Icon = metric.icon;

          return (
            <li key={metric.key}>
              <Link
                href={metric.path(row.classSlug)}
                className="border-border hover:bg-muted flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors"
              >
                <Icon
                  aria-hidden="true"
                  className="text-muted-foreground h-4 w-4 shrink-0"
                />
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
                  {metric.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    value > 0 ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {value}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href={`/dashboard/classes/${row.classSlug}/manage`}
        className="text-accent hover:text-accent-hover mt-3 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
      >
        Manage this class
        <ArrowRight
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
      </Link>
    </Card>
  );
}

export default async function ActionCenterPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Action center</h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/dashboard/actions"));
  }

  const center = await getClassActionCenter(session.user.id).catch(() => null);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
          Class leader
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Action center
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          {center === null
            ? "Everything waiting on you across the classes you lead."
            : buildSummary(center.totals)}{" "}
          Today&apos;s sessions are counted in Asia/Jakarta time.
        </p>
      </header>

      {center === null ? (
        <Alert
          variant="error"
          className="mt-6"
        >
          Your action counts could not be loaded. Refresh the page to try again.
        </Alert>
      ) : center.rows.length === 0 ? (
        <div className="border-border bg-subtle mt-6 rounded-xl border border-dashed px-6 py-10 text-center">
          <ListChecks
            aria-hidden="true"
            className="text-muted-foreground mx-auto h-6 w-6"
          />
          <p className="mt-2 text-sm font-medium">No classes to lead yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
            This page collects review queues for class leaders. Once you
            administer an active class, its pending work appears here.
          </p>
          <Link
            href="/classes"
            className="text-accent hover:text-accent-hover mt-4 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            Go to my classes
            <ArrowRight
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          </Link>
        </div>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {TOTAL_METRICS.map((metric) => {
              const Icon = metric.icon;
              const value = center.totals[metric.key];

              return (
                <Card
                  key={metric.key}
                  className="p-4"
                >
                  <dt className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Icon
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                    />
                    {metric.label}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums">
                    {value}
                  </dd>
                </Card>
              );
            })}
          </dl>

          {center.totals.actions === 0 ? (
            <div className="border-border bg-subtle mt-6 rounded-xl border border-dashed px-6 py-10 text-center">
              <ListChecks
                aria-hidden="true"
                className="text-muted-foreground mx-auto h-6 w-6"
              />
              <p className="mt-2 text-sm font-medium">All caught up</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
                No submissions, absence requests, sessions, or reader reports
                need you right now. New work appears here as it arrives.
              </p>
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            {center.rows.map((row) => (
              <ClassActionsCard
                key={row.classId}
                row={row}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

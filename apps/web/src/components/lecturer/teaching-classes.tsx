import { ClipboardList, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type ActionCenterRow } from "@/lib/classes/action-center";
import { type LecturerClass } from "@/lib/db/lecturer";
import { cn } from "@/lib/utils/cn";
import { pluralize } from "@starstask/shared";

const MUTED_TEXT = "text-muted-foreground dark:text-[#aaa69e]";
const PANEL =
  "border-border bg-surface text-foreground dark:border-white/[0.06] dark:bg-[#23231f] dark:text-[#ece9e3]";

type TeachingClassesProps = {
  classes: LecturerClass[];
  rowsByClassId: Map<string, ActionCenterRow>;
  actionCenterUnavailable?: boolean;
  /** Meetings-held percent (0-100) per class, from BAP progress data. */
  progressByClassId?: Map<string, number>;
};

/** Roster cards for every class the caller administers. */
export function TeachingClasses({
  classes,
  rowsByClassId,
  actionCenterUnavailable = false,
  progressByClassId,
}: TeachingClassesProps) {
  return (
    <section
      aria-labelledby="teaching-classes"
      className={cn("flex h-full flex-col rounded-xl border p-4 sm:p-5", PANEL)}
    >
      <div className="flex items-end justify-between gap-3">
        <h2
          id="teaching-classes"
          className="text-foreground flex items-center gap-2 text-lg font-semibold tracking-tight dark:text-[#ece9e3]"
        >
          <Users
            aria-hidden="true"
            className="h-4 w-4 text-[#5b6b45] dark:text-[#a3b07d]"
          />
          Classes you teach
        </h2>
        <Link
          href="/classes"
          className="text-accent focus-visible:outline-accent rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-[#c3ccad]"
        >
          All classes
        </Link>
      </div>

      {classes.length === 0 ? (
        <div className="border-border mt-3 flex flex-1 items-center rounded-xl border border-dashed px-4 py-6 dark:border-white/[0.1]">
          <div>
            <p className="text-foreground text-sm font-medium dark:text-[#ece9e3]">
              You do not teach any class yet
            </p>
            <p
              className={cn(
                "mt-1 max-w-md text-sm leading-relaxed",
                MUTED_TEXT,
              )}
            >
              A class appears here once you are assigned as a class admin for an
              active class.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                asChild
                size="sm"
                variant="secondary"
              >
                <Link href="/classes">Browse classes</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <ul className="mt-3 grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((row) => (
            <li key={row.id}>
              <TeachingClassCard
                counts={rowsByClassId.get(row.id)}
                row={row}
                actionCenterUnavailable={actionCenterUnavailable}
                progressPercent={progressByClassId?.get(row.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.trim().toLowerCase();
  const isActive = normalized === "active";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        isActive
          ? "border-[#5cb98a]/30 bg-[#5cb98a]/10 text-[#3f7d5b] dark:border-[#5cb98a]/25 dark:bg-[#5cb98a]/10 dark:text-[#7fd0a4]"
          : "border-border bg-muted text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#a19d92]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive ? "bg-[#5cb98a]" : "bg-[#a19d92]",
        )}
      />
      {isActive ? "Active" : status}
    </span>
  );
}

function TeachingClassCard({
  row,
  counts,
  actionCenterUnavailable,
  progressPercent,
}: {
  row: LecturerClass;
  counts: ActionCenterRow | undefined;
  actionCenterUnavailable: boolean;
  progressPercent?: number;
}) {
  const waiting = counts
    ? counts.pendingSubmissions + counts.pendingLeave + counts.openReports
    : 0;
  const percent =
    typeof progressPercent === "number" && Number.isFinite(progressPercent)
      ? Math.min(100, Math.max(0, Math.round(progressPercent)))
      : null;

  return (
    <Card className="border-border flex h-full flex-col transition-[border-color] dark:border-white/[0.06] dark:bg-[#23231f] dark:hover:border-white/[0.12]">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] dark:bg-white/[0.06] dark:text-[#b6b2a7]">
          {row.class_code ?? row.slug}
        </span>
        <span className={MUTED_TEXT}>
          {row.semester} · {row.academic_year}
        </span>
        <StatusPill status={row.status} />
        {!actionCenterUnavailable && waiting > 0 ? (
          <Badge
            className="ml-auto"
            variant="warning"
          >
            {waiting} waiting
          </Badge>
        ) : null}
      </div>

      <h3 className="text-foreground mt-2 text-base leading-snug font-semibold dark:text-[#ece9e3]">
        <Link
          href={`/classes/${row.slug}`}
          className="hover:text-accent focus-visible:outline-accent rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:text-[#c3ccad]"
        >
          {row.name}
        </Link>
      </h3>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className={cn("text-xs", MUTED_TEXT)}>{row.course_name}</p>
      </div>

      <div
        className={cn(
          "mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs",
          MUTED_TEXT,
        )}
      >
        <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 dark:bg-white/[0.06] dark:text-[#b6b2a7]">
          <Users
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          {row.member_count} {pluralize(row.member_count, "member")}
        </span>
        <span className="inline-flex items-center gap-1">
          <ClipboardList
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          {row.published_count}{" "}
          {pluralize(row.published_count, "published task")}
        </span>
      </div>

      {percent !== null ? (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-muted-foreground dark:text-[#aaa69e]">
            <span>Meetings</span>
            <span className="tabular-nums text-foreground dark:text-[#ece9e3]">
              {percent}%
            </span>
          </div>
          <div
            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted dark:bg-white/[0.08]"
            role="progressbar"
            aria-label={`${row.name} meetings held`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full rounded-full bg-[#5b6b45] transition-[width] dark:bg-[#6f7f52]"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="border-border mt-auto flex flex-wrap gap-x-4 gap-y-2 border-t pt-4 dark:border-white/[0.06]">
        <ClassLink
          href={`/classes/${row.slug}/manage`}
          label="Manage"
        />
        <ClassLink
          href={`/classes/${row.slug}/sessions`}
          label="Sessions"
        />
        <ClassLink
          href={`/classes/${row.slug}/attendance`}
          label="Attendance"
        />
        <ClassLink
          href={`/classes/${row.slug}/leave-requests`}
          label="Absences"
        />
        <ClassLink
          href={`/classes/${row.slug}/submit`}
          label="New task"
        />
      </div>
    </Card>
  );
}

function ClassLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-accent hover:text-accent-hover focus-visible:outline-accent inline-flex items-center gap-1 rounded-sm text-xs font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-[#c3ccad] dark:hover:text-[#d6dcbc]"
    >
      {label}
    </Link>
  );
}

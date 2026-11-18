import { ClipboardList, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type ActionCenterRow } from "@/lib/classes/action-center";
import { type LecturerClass } from "@/lib/db/lecturer";
import { cn } from "@/lib/utils/cn";
import { pluralize } from "@starstask/shared";

const MUTED_TEXT = "text-muted-foreground dark:text-[#93a1bd]";
const PANEL =
  "border-border bg-surface text-foreground dark:border-white/[0.06] dark:bg-[#131e33] dark:text-[#e6ebf5]";

type TeachingClassesProps = {
  classes: LecturerClass[];
  rowsByClassId: Map<string, ActionCenterRow>;
  actionCenterUnavailable?: boolean;
};

/** Roster cards for every class the caller administers. */
export function TeachingClasses({
  classes,
  rowsByClassId,
  actionCenterUnavailable = false,
}: TeachingClassesProps) {
  return (
    <section
      aria-labelledby="teaching-classes"
      className={cn("flex h-full flex-col rounded-xl border p-4 sm:p-5", PANEL)}
    >
      <div className="flex items-end justify-between gap-3">
        <h2
          id="teaching-classes"
          className="text-foreground flex items-center gap-2 text-lg font-semibold tracking-tight dark:text-[#e6ebf5]"
        >
          <Users
            aria-hidden="true"
            className="h-4 w-4 text-[#2563eb] dark:text-[#60a5fa]"
          />
          Classes you teach
        </h2>
        <Link
          href="/classes"
          className="text-accent focus-visible:outline-accent rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-[#8fb0e8]"
        >
          All classes
        </Link>
      </div>

      {classes.length === 0 ? (
        <div className="border-border mt-3 flex flex-1 items-center rounded-xl border border-dashed px-4 py-6 dark:border-white/[0.1]">
          <div>
            <p className="text-foreground text-sm font-medium dark:text-[#e6ebf5]">
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
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TeachingClassCard({
  row,
  counts,
  actionCenterUnavailable,
}: {
  row: LecturerClass;
  counts: ActionCenterRow | undefined;
  actionCenterUnavailable: boolean;
}) {
  const waiting = counts
    ? counts.pendingSubmissions + counts.pendingLeave + counts.openReports
    : 0;

  return (
    <Card className="border-border bg-subtle flex h-full flex-col transition-[border-color] dark:border-white/[0.06] dark:bg-[#0d1526]">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] dark:bg-white/[0.06] dark:text-[#aeb9d6]">
          {row.class_code ?? row.slug}
        </span>
        <span className={MUTED_TEXT}>
          {row.semester} · {row.academic_year}
        </span>
        {!actionCenterUnavailable && waiting > 0 ? (
          <Badge
            className="ml-auto"
            variant="warning"
          >
            {waiting} waiting
          </Badge>
        ) : null}
      </div>

      <h3 className="text-foreground mt-2 text-base leading-snug font-semibold dark:text-[#e6ebf5]">
        <Link
          href={`/classes/${row.slug}`}
          className="hover:text-accent focus-visible:outline-accent rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:text-[#8fb0e8]"
        >
          {row.name}
        </Link>
      </h3>
      <p className={cn("mt-1 text-xs", MUTED_TEXT)}>{row.course_name}</p>

      <div
        className={cn(
          "mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs",
          MUTED_TEXT,
        )}
      >
        <span className="inline-flex items-center gap-1">
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
      </div>
    </Card>
  );
}

function ClassLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-accent hover:text-accent-hover focus-visible:outline-accent inline-flex items-center gap-1 rounded-sm text-xs font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-[#8fb0e8] dark:hover:text-[#a8c2f0]"
    >
      {label}
    </Link>
  );
}

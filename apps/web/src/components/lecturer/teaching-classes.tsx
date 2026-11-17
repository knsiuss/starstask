import { ClipboardList, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type ActionCenterRow } from "@/lib/classes/action-center";
import { type LecturerClass } from "@/lib/db/lecturer";
import { pluralize } from "@starstask/shared";

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
      className="mt-8"
    >
      <div className="flex items-end justify-between gap-3">
        <h2
          id="teaching-classes"
          className="text-lg font-semibold tracking-tight"
        >
          Classes you teach
        </h2>
        <Link
          href="/classes"
          className="text-accent text-sm font-medium hover:underline"
        >
          All classes
        </Link>
      </div>

      {classes.length === 0 ? (
        <Card className="mt-3 border-dashed">
          <p className="text-sm font-medium">You do not teach any class yet</p>
          <p className="text-muted-foreground mt-1 max-w-md text-sm leading-relaxed">
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
        </Card>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
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
    <Card className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
          {row.class_code ?? row.slug}
        </span>
        <span className="text-muted-foreground">
          {row.semester} · {row.academic_year}
        </span>
        {!actionCenterUnavailable ? (
          <Badge
            className="ml-auto"
            variant={waiting > 0 ? "warning" : "success"}
          >
            {waiting > 0 ? `${waiting} waiting` : "Clear"}
          </Badge>
        ) : null}
      </div>

      <h3 className="mt-2 text-base leading-snug font-semibold">
        <Link
          href={`/app/classes/${row.slug}`}
          className="hover:text-accent focus-visible:outline-accent rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {row.name}
        </Link>
      </h3>
      <p className="text-muted-foreground mt-1 text-xs">{row.course_name}</p>

      <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-3 text-xs">
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

      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 pt-4">
        <ClassLink
          href={`/app/classes/${row.slug}/manage`}
          label="Manage"
        />
        <ClassLink
          href={`/app/classes/${row.slug}/sessions`}
          label="Sessions"
        />
        <ClassLink
          href={`/app/classes/${row.slug}/attendance`}
          label="Attendance"
        />
        <ClassLink
          href={`/app/classes/${row.slug}/leave-requests`}
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
      className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
    >
      {label}
    </Link>
  );
}

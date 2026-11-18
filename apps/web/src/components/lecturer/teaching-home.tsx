import { ArrowRight, ListChecks } from "lucide-react";
import Link from "next/link";

import {
  TeachingAttention,
  TeachingToday,
} from "@/components/lecturer/teaching-attention";
import { TeachingBapProgress } from "@/components/lecturer/teaching-bap-progress";
import { TeachingClasses } from "@/components/lecturer/teaching-classes";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { type ActionCenterRow } from "@/lib/classes/action-center";
import { getClassActionCenter } from "@/lib/db/class-actions";
import { getLecturerOverview } from "@/lib/db/lecturer";
import { getLecturerBapProgress } from "@/lib/db/lecturer-bap";
import { pluralize } from "@starstask/shared";

type TeachingHomeProps = {
  userId: string;
  displayName: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Asia/Jakarta",
});

/**
 * Teaching console shown at `/lecturer` for verified lecturers.
 */
export async function TeachingHome({ userId, displayName }: TeachingHomeProps) {
  const [overview, actionCenter, bapSummary] = await Promise.all([
    getLecturerOverview(userId).catch(() => null),
    getClassActionCenter(userId).catch(() => null),
    getLecturerBapProgress(userId).catch(() => null),
  ]);

  if (!overview) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-12 sm:px-6 sm:py-8 lg:px-8">
      <header className="border-border flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-muted-foreground text-xs font-medium">
            {dateFormatter.format(new Date())}
            <span aria-hidden="true"> · </span>
            {overview.classCount} {pluralize(overview.classCount, "class")}
            <span aria-hidden="true"> · </span>
            {overview.memberCount} {pluralize(overview.memberCount, "member")}
          </p>
          <h1 className="text-foreground mt-1.5 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            {displayName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/app?view=student"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
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
          <p className="text-foreground text-sm font-medium">
            No teaching classes yet
          </p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed">
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
              <Link href="/classes/create?tab=krs">Import KRS / Schedule</Link>
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
          {actionCenter ? (
            <TeachingAttention totals={actionCenter.totals} />
          ) : (
            <Alert
              variant="error"
              className="mt-7"
            >
              Could not load your action center counts. Try again in a moment.
            </Alert>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
            <TeachingToday rows={rows} />
            <TeachingBapProgress summary={bapSummary} />
          </div>

          <TeachingClasses
            classes={overview.classes}
            rowsByClassId={rowsByClassId}
            actionCenterUnavailable={!actionCenter}
          />
        </>
      )}

      <p className="text-muted-foreground mt-10 max-w-2xl text-[11px] leading-relaxed">
        StarsTask is not your university&rsquo;s official system. Attendance and
        grades recorded here are working notes; the official record stays on
        your university&rsquo;s own systems after you verify it there.
      </p>
    </div>
  );
}

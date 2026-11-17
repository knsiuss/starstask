import { CalendarClock, Layers, ListChecks } from "lucide-react";
import Link from "next/link";

import {
  TeachingAttention,
  TeachingShortcuts,
  TeachingToday,
} from "@/components/lecturer/teaching-attention";
import { TeachingClasses } from "@/components/lecturer/teaching-classes";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { type ActionCenterRow } from "@/lib/classes/action-center";
import { getClassActionCenter } from "@/lib/db/class-actions";
import { getLecturerOverview } from "@/lib/db/lecturer";
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
 * Teaching console shown at `/app` for verified lecturers.
 *
 * The student dashboard answers "what do I owe?"; a lecturer opens the app to
 * ask "what is waiting on me?". The two therefore share no section: this page
 * leads with the review queue, absence requests, and today's sessions across
 * the classes the caller administers.
 */
export async function TeachingHome({ userId, displayName }: TeachingHomeProps) {
  const [overview, actionCenter] = await Promise.all([
    getLecturerOverview(userId).catch(() => null),
    getClassActionCenter(userId).catch(() => null),
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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-10 sm:px-6 sm:py-8 lg:px-8">
      <section className="border-accent/20 bg-accent-soft/50 overflow-hidden rounded-xl border p-5 sm:p-6">
        <p className="text-accent text-[11px] font-semibold tracking-[0.12em] uppercase">
          Teaching workspace
        </p>
        <h1 className="text-foreground mt-2 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          {displayName}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {dateFormatter.format(new Date())}
          <span aria-hidden="true"> · </span>
          {overview.classCount} {pluralize(overview.classCount, "class")}
          <span aria-hidden="true"> · </span>
          {overview.memberCount} {pluralize(overview.memberCount, "member")}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            asChild
            size="sm"
          >
            <Link href="/app/actions">
              <ListChecks
                aria-hidden="true"
                className="h-4 w-4"
              />
              Action center
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="secondary"
          >
            <Link href="/classes">
              <Layers
                aria-hidden="true"
                className="h-4 w-4"
              />
              My classes
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="secondary"
          >
            <Link href="/attendance">
              <CalendarClock
                aria-hidden="true"
                className="h-4 w-4"
              />
              Attendance
            </Link>
          </Button>
        </div>
      </section>

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

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <TeachingToday rows={rows} />
        <TeachingShortcuts />
      </div>

      <TeachingClasses
        classes={overview.classes}
        rowsByClassId={rowsByClassId}
        actionCenterUnavailable={!actionCenter}
      />

      <p className="text-muted-foreground mt-8 max-w-2xl text-[11px] leading-relaxed">
        StarsTask is not your university&rsquo;s official system. Attendance and
        grades recorded here are working notes; the official record stays on
        your university&rsquo;s own systems after you verify it there.
      </p>
    </div>
  );
}

import { CalendarDays, ExternalLink } from "lucide-react";
import Link from "next/link";

import { ScheduleManager } from "@/components/schedule/schedule-manager";
import type { ScheduleSubjectOption } from "@/components/schedule/schedule-entry-form";
import { Button } from "@/components/ui/button";
import type { ClassScheduleEntry } from "@/lib/db/class-schedule";

type ClassScheduleTabProps = {
  classSlug: string;
  subjects: ScheduleSubjectOption[];
  entries: ClassScheduleEntry[];
  memberCount: number;
  canCreateCourses: boolean;
};

export function ClassScheduleTab({
  classSlug,
  subjects,
  entries,
  memberCount,
  canCreateCourses,
}: ClassScheduleTabProps) {
  return (
    <section
      aria-labelledby="class-schedule"
      className="mt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-accent-soft text-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <CalendarDays
              aria-hidden="true"
              className="h-5 w-5"
            />
          </span>
          <div>
            <h2
              id="class-schedule"
              className="text-xl font-semibold tracking-tight"
            >
              Weekly Schedule
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              The recurring meeting times of each subject. Members can view the
              shared timetable, and the calendar updates for everyone.
            </p>
          </div>
        </div>
        <Button
          asChild
          size="sm"
          variant="secondary"
          className="rounded-full"
        >
          <Link href="/schedule">
            <ExternalLink
              aria-hidden="true"
              className="h-4 w-4"
            />
            Open calendar
          </Link>
        </Button>
      </div>

      <div className="mt-5">
        <ScheduleManager
          classSlug={classSlug}
          subjects={subjects}
          entries={entries}
          memberCount={memberCount}
          canCreateCourses={canCreateCourses}
        />
      </div>
    </section>
  );
}

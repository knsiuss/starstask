import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { ScheduleManager } from "@/components/schedule/schedule-manager";
import type { ScheduleSubjectOption } from "@/components/schedule/schedule-entry-form";
import type { ClassScheduleEntry } from "@/lib/db/class-schedule";

type ClassScheduleTabProps = {
  classSlug: string;
  subjects: ScheduleSubjectOption[];
  entries: ClassScheduleEntry[];
};

export function ClassScheduleTab({
  classSlug,
  subjects,
  entries,
}: ClassScheduleTabProps) {
  return (
    <section
      aria-labelledby="class-schedule"
      className="mt-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="class-schedule"
            className="text-lg font-semibold tracking-tight"
          >
            Weekly schedule
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            The recurring meeting times of each subject. Every class member can
            maintain the shared timetable, and the calendar updates for
            everyone.
          </p>
        </div>
        <Link
          href="/schedule"
          className="text-accent inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <CalendarDays
            aria-hidden="true"
            className="h-4 w-4"
          />
          Open calendar
        </Link>
      </div>

      <div className="mt-4">
        <ScheduleManager
          classSlug={classSlug}
          subjects={subjects}
          entries={entries}
        />
      </div>
    </section>
  );
}

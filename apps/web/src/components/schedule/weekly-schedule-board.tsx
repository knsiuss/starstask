import Link from "next/link";

import type { WeeklyScheduleEntry } from "@/lib/db/class-schedule";
import {
  CLASS_SCHEDULE_DAY_LABELS,
  CLASS_SCHEDULE_DAYS,
} from "@starstask/contracts";

/**
 * Read-only weekly timetable grouped by day, used where members consume the
 * schedule. Editing lives on the class page (ScheduleManager).
 */
export function WeeklyScheduleBoard({
  entries,
}: {
  entries: WeeklyScheduleEntry[];
}) {
  if (entries.length === 0) {
    return (
      <div className="border-border bg-subtle rounded-lg border border-dashed px-5 py-6 text-center">
        <p className="text-sm font-medium">No class hours saved yet</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-md text-xs">
          Members can add the weekly meeting times of each subject on the class
          page, and they will show up here.
        </p>
      </div>
    );
  }

  const daysWithEntries = CLASS_SCHEDULE_DAYS.map((day) => ({
    day,
    items: entries.filter((entry) => entry.day_of_week === day),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {daysWithEntries.map(({ day, items }) => (
        <div
          key={day}
          className="border-border bg-surface rounded-lg border p-4"
        >
          <h3 className="text-sm font-semibold tracking-tight">
            {CLASS_SCHEDULE_DAY_LABELS[day]}
          </h3>
          <ul className="mt-2 space-y-2.5">
            {items.map((entry) => (
              <li
                key={entry.id}
                className="text-sm"
              >
                <p className="font-medium">
                  {entry.start_time}–{entry.end_time} · {entry.subject_name}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  <Link
                    href={`/dashboard/classes/${entry.class_slug}`}
                    className="hover:underline"
                  >
                    {entry.class_name}
                  </Link>
                  {entry.room ? ` · ${entry.room}` : ""}
                  {(entry.lecturer_name ?? entry.subject_lecturer_name)
                    ? ` · ${entry.lecturer_name ?? entry.subject_lecturer_name}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

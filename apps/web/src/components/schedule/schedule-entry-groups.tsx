import { Loader2, Pencil, Trash2 } from "lucide-react";

import {
  CLASS_SCHEDULE_DAY_LABELS,
  CLASS_SCHEDULE_DAYS,
  type ClassScheduleDay,
} from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

import { Button } from "@/components/ui/button";
import type { ClassScheduleEntry } from "@/lib/db/class-schedule";

type ScheduleEntryGroupsProps = {
  entries: ClassScheduleEntry[];
  busyId: string | null;
  editingId: string | null;
  onEdit: (entry: ClassScheduleEntry) => void;
  onRemove: (id: string) => void;
};

export function ScheduleEntryGroups({
  entries,
  busyId,
  editingId,
  onEdit,
  onRemove,
}: ScheduleEntryGroupsProps) {
  const grouped = CLASS_SCHEDULE_DAYS.map((day) => ({
    day,
    items: entries.filter((entry) => entry.day_of_week === day),
  })).filter((group) => group.items.length > 0);

  if (grouped.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No class hours saved yet. Add the first slot using the form.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {grouped.map(({ day, items }) => (
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
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {entry.start_time}–{entry.end_time} · {entry.subject_name}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {entry.room ? `${entry.room} · ` : ""}
                      {entry.lecturer_name ??
                        entry.subject_lecturer_name ??
                        "No lecturer set"}
                      {entry.lecturer_name ? " (from this entry)" : ""}
                    </p>
                    {entry.period || entry.start_date || entry.end_date ? (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {entry.period ? `Period ${entry.period}` : ""}
                        {entry.period && (entry.start_date || entry.end_date)
                          ? " · "
                          : ""}
                        {entry.start_date ? formatDate(entry.start_date) : ""}
                        {entry.start_date && entry.end_date ? " – " : ""}
                        {entry.end_date ? formatDate(entry.end_date) : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(entry)}
                      disabled={busyId !== null}
                      aria-label={`Edit ${entry.subject_name} on ${CLASS_SCHEDULE_DAY_LABELS[entry.day_of_week as ClassScheduleDay]}`}
                    >
                      {busyId === entry.id && editingId === entry.id ? (
                        <Loader2
                          aria-hidden="true"
                          className="h-3.5 w-3.5 animate-spin"
                        />
                      ) : (
                        <Pencil
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                        />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemove(entry.id)}
                      disabled={busyId !== null}
                      aria-label={`Remove ${entry.subject_name} on ${CLASS_SCHEDULE_DAY_LABELS[entry.day_of_week as ClassScheduleDay]}`}
                    >
                      <Trash2
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

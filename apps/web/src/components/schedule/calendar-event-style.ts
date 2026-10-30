import type { CalendarEventType } from "@starstask/contracts";

/** Soft/foreground pair per source, shared by chips and legend. */
export const CALENDAR_EVENT_TONES: Record<
  Exclude<CalendarEventType, "all">,
  string
> = {
  class_schedule: "bg-accent-soft text-accent",
  assignment: "bg-danger-soft text-danger",
  exam: "bg-warning-soft text-warning",
  academic_event: "bg-success-soft text-success",
  personal: "bg-muted text-foreground",
};

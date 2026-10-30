import { z } from "zod";

import { isoDateTimeWithOffsetSchema } from "./assignment";
import { timeZoneSchema } from "./push";

/** The four calendar surfaces share one query and one event list. */
export const CALENDAR_VIEWS = ["month", "week", "day", "agenda"] as const;

export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/**
 * `assignment` is read from the assignment record and `class_schedule` also
 * includes recurring timetable occurrences and discussion sessions. Official
 * events stored in `class_calendar_events` are `exam`, `academic_event`, or a
 * one-off `class_schedule`.
 */
export const CALENDAR_EVENT_TYPES = [
  "all",
  "class_schedule",
  "assignment",
  "exam",
  "academic_event",
  "personal",
] as const;

export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

/** Types a class admin may create directly. */
export const OFFICIAL_CALENDAR_EVENT_TYPES = [
  "class_schedule",
  "exam",
  "academic_event",
] as const;

export type OfficialCalendarEventType =
  (typeof OFFICIAL_CALENDAR_EVENT_TYPES)[number];

export const CALENDAR_EVENT_TYPE_LABELS: Record<
  Exclude<CalendarEventType, "all">,
  string
> = {
  class_schedule: "Class schedule",
  assignment: "Assignment deadline",
  exam: "Exam",
  academic_event: "Academic event",
  personal: "Personal event",
};

export const CALENDAR_EVENT_STATUSES = [
  "published",
  "cancelled",
  "archived",
] as const;

export type CalendarEventStatus = (typeof CALENDAR_EVENT_STATUSES)[number];

export const CALENDAR_QUERY_DATE_MAX_LENGTH = 10;
export const CALENDAR_TITLE_MIN = 2;
export const CALENDAR_TITLE_MAX = 160;
export const CALENDAR_DESCRIPTION_MAX = 2_000;
export const CALENDAR_OFFICIAL_DESCRIPTION_MAX = 5_000;
export const CALENDAR_LOCATION_MAX = 200;
export const CALENDAR_PERSONAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;
export const CALENDAR_OFFICIAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

const dateKeySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format");

/**
 * Filters are read from a GET form, so every value arrives as a string. The
 * page falls back to the defaults instead of rejecting hand-edited URLs.
 */
export const calendarQuerySchema = z.object({
  view: z.enum(CALENDAR_VIEWS).default("month"),
  date: dateKeySchema.optional(),
  type: z.enum(CALENDAR_EVENT_TYPES).default("all"),
  class: z.uuid("Invalid class filter").optional(),
  subject: z.uuid("Invalid subject filter").optional(),
});

export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

export const calendarEventIdSchema = z.uuid("Invalid event id");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === "" || value === null ? undefined : value));

const eventFields = {
  title: z
    .string()
    .trim()
    .min(CALENDAR_TITLE_MIN, "Give the event a title")
    .max(
      CALENDAR_TITLE_MAX,
      `Keep the title under ${CALENDAR_TITLE_MAX} characters`,
    ),
  startsAt: isoDateTimeWithOffsetSchema,
  endsAt: isoDateTimeWithOffsetSchema,
  timeZone: timeZoneSchema.default("Asia/Jakarta"),
  location: optionalText(CALENDAR_LOCATION_MAX),
};

type EventWindow = { startsAt: string; endsAt: string };

function refineEventWindow(maxDurationMs: number) {
  return (value: EventWindow, context: z.RefinementCtx): void => {
    const start = Date.parse(value.startsAt);
    const end = Date.parse(value.endsAt);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return;
    }

    if (end <= start) {
      context.addIssue({
        code: "custom",
        message: "The end time must be after the start time",
        path: ["endsAt"],
      });

      return;
    }

    if (end - start > maxDurationMs) {
      context.addIssue({
        code: "custom",
        message: "That event is too long",
        path: ["endsAt"],
      });
    }
  };
}

export const personalCalendarEventCreateSchema = z
  .object({
    ...eventFields,
    description: optionalText(CALENDAR_DESCRIPTION_MAX),
  })
  .strict()
  .superRefine(refineEventWindow(CALENDAR_PERSONAL_WINDOW_MS));

export type PersonalCalendarEventCreateInput = z.infer<
  typeof personalCalendarEventCreateSchema
>;

export const personalCalendarEventUpdateSchema =
  personalCalendarEventCreateSchema;

export type PersonalCalendarEventUpdateInput = z.infer<
  typeof personalCalendarEventUpdateSchema
>;

export const classCalendarEventCreateSchema = z
  .object({
    ...eventFields,
    description: optionalText(CALENDAR_OFFICIAL_DESCRIPTION_MAX),
    eventType: z.enum(OFFICIAL_CALENDAR_EVENT_TYPES, "Choose an event type"),
    subjectId: z
      .uuid("Choose a subject")
      .optional()
      .nullable()
      .transform((value) => value ?? undefined),
  })
  .strict()
  .superRefine(refineEventWindow(CALENDAR_OFFICIAL_WINDOW_MS));

export type ClassCalendarEventCreateInput = z.infer<
  typeof classCalendarEventCreateSchema
>;

export const classCalendarEventUpdateSchema = classCalendarEventCreateSchema;

export type ClassCalendarEventUpdateInput = z.infer<
  typeof classCalendarEventUpdateSchema
>;

export const calendarEventStatusSchema = z
  .object({
    status: z.enum(CALENDAR_EVENT_STATUSES, "Choose a valid status"),
  })
  .strict();

export type CalendarEventStatusInput = z.infer<
  typeof calendarEventStatusSchema
>;

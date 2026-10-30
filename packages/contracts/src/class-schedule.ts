import { z } from "zod";

export const CLASS_SCHEDULE_ROOM_MAX = 120;
export const CLASS_SCHEDULE_LECTURER_MAX = 120;

/** ISO weekday: 1 = Monday .. 7 = Sunday. */
export const CLASS_SCHEDULE_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export type ClassScheduleDay = (typeof CLASS_SCHEDULE_DAYS)[number];

export const CLASS_SCHEDULE_DAY_LABELS: Record<ClassScheduleDay, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export const classScheduleIdSchema = z.uuid("Invalid schedule id");

/** Wall-clock `HH:mm` (24 hour). Lexicographic order equals time order. */
const scheduleTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the 24-hour format HH:mm");

const optionalScheduleText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === "" || value === null ? undefined : value));

/**
 * Create and update are full replacements, matching the session schemas: the
 * form always submits every control, so an omitted optional field clears it.
 */
const classScheduleFields = {
  subjectId: z.uuid("Choose a subject"),
  dayOfWeek: z.number().int().min(1, "Choose a day").max(7, "Choose a day"),
  startTime: scheduleTimeSchema,
  endTime: scheduleTimeSchema,
  room: optionalScheduleText(CLASS_SCHEDULE_ROOM_MAX),
  lecturerName: optionalScheduleText(CLASS_SCHEDULE_LECTURER_MAX),
};

type ScheduleWindowFields = {
  startTime: string;
  endTime: string;
};

function refineScheduleWindow(
  value: ScheduleWindowFields,
  context: z.RefinementCtx,
): void {
  // Both values are `HH:mm`, so string comparison is a correct time compare.
  if (value.startTime >= value.endTime) {
    context.addIssue({
      code: "custom",
      message: "The end time must be after the start time",
      path: ["endTime"],
    });
  }
}

export const classScheduleCreateSchema = z
  .object(classScheduleFields)
  .strict()
  .superRefine(refineScheduleWindow);

export type ClassScheduleCreateInput = z.infer<
  typeof classScheduleCreateSchema
>;

export const classScheduleUpdateSchema = z
  .object(classScheduleFields)
  .strict()
  .superRefine(refineScheduleWindow);

export type ClassScheduleUpdateInput = z.infer<
  typeof classScheduleUpdateSchema
>;

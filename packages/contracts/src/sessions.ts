import { z } from "zod";

import { isoDateTimeWithOffsetSchema } from "./assignment";
import { timeZoneSchema } from "./push";

export const SESSION_STATUSES = [
  "scheduled",
  "cancelled",
  "completed",
] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_TYPES = ["online", "in_person"] as const;

export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_VISIBILITIES = ["class_members", "public"] as const;

export type SessionVisibility = (typeof SESSION_VISIBILITIES)[number];

export const RSVP_STATUSES = ["going", "maybe", "not_going"] as const;

export type RsvpStatus = (typeof RSVP_STATUSES)[number];

/** List filter. `upcoming` means scheduled and not yet finished. */
export const SESSION_LIST_STATUSES = [
  "upcoming",
  "all",
  "scheduled",
  "cancelled",
  "completed",
] as const;

export type SessionListStatus = (typeof SESSION_LIST_STATUSES)[number];

export const SESSION_VIEWS = ["list", "calendar"] as const;

export type SessionView = (typeof SESSION_VIEWS)[number];

export const SESSION_TITLE_MIN = 3;
export const SESSION_TITLE_MAX = 160;
export const SESSION_DESCRIPTION_MIN = 10;
export const SESSION_DESCRIPTION_MAX = 5_000;
export const SESSION_AGENDA_MAX = 5_000;
export const SESSION_LOCATION_MAX = 200;
export const SESSION_MEETING_URL_MAX = 2_048;
export const SESSION_CAPACITY_MIN = 1;
export const SESSION_CAPACITY_MAX = 1_000;
export const SESSION_MAX_DURATION_MS = 24 * 60 * 60 * 1000;

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  online: "Online",
  in_person: "In person",
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: "Scheduled",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const RSVP_STATUS_LABELS: Record<RsvpStatus, string> = {
  going: "Going",
  maybe: "Maybe",
  not_going: "Not going",
};

export const SESSION_CHECKIN_STATUSES = [
  "present",
  "late",
  "excused",
  "absent",
] as const;

export type SessionCheckInStatus = (typeof SESSION_CHECKIN_STATUSES)[number];

export const SESSION_CHECKIN_STATUS_LABELS: Record<
  SessionCheckInStatus,
  string
> = {
  present: "Present",
  late: "Late",
  excused: "Excused",
  absent: "Absent",
};

/**
 * Server rules, mirrored here so the form and the route can reject the same
 * values with a readable message before the database does. The database remains
 * the authority.
 */
export const SESSION_CHECKIN_ACCURACY_MAX_M = 100;
export const SESSION_CHECKIN_RADIUS_MIN = 25;
export const SESSION_CHECKIN_RADIUS_MAX = 1_000;
export const SESSION_CHECKIN_LEAD_MS = 15 * 60 * 1_000;
export const SESSION_CHECKIN_LATE_AFTER_MS = 10 * 60 * 1_000;

export const sessionIdSchema = z.uuid("Invalid session id");

export const sessionCheckInIdSchema = z.uuid("Invalid check-in id");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === "" || value === null ? undefined : value));

/**
 * A meeting link must be an absolute https URL. A `javascript:` or `data:` URL
 * would be stored and later rendered as a link, so it is rejected here and
 * again by a database check constraint.
 */
const meetingUrlSchema = z
  .string()
  .trim()
  .max(SESSION_MEETING_URL_MAX, "Meeting link is too long")
  .refine((value) => value.startsWith("https://"), {
    message: "Meeting link must start with https://",
  })
  .optional()
  .nullable()
  .transform((value) => (value === "" || value === null ? undefined : value));

const capacitySchema = z
  .union([z.literal(""), z.null(), z.coerce.number().int()])
  .optional()
  .transform((value) =>
    value === "" || value === null || value === undefined ? undefined : value,
  )
  .refine(
    (value) =>
      value === undefined ||
      (value >= SESSION_CAPACITY_MIN && value <= SESSION_CAPACITY_MAX),
    { message: `Capacity must be between 1 and ${SESSION_CAPACITY_MAX}` },
  );

/**
 * Fields shared by create and update. Both are full replacements: an omitted
 * optional field means "no value", which is why the form always submits every
 * control rather than a patch.
 */
const sessionFields = {
  title: z
    .string()
    .trim()
    .min(SESSION_TITLE_MIN, "Title must be at least 3 characters")
    .max(SESSION_TITLE_MAX, "Title must be 160 characters or fewer"),
  description: z
    .string()
    .trim()
    .min(SESSION_DESCRIPTION_MIN, "Description must be at least 10 characters")
    .max(
      SESSION_DESCRIPTION_MAX,
      "Description must be 5,000 characters or fewer",
    ),
  agenda: optionalText(SESSION_AGENDA_MAX),
  sessionType: z.enum(SESSION_TYPES).default("online"),
  meetingUrl: meetingUrlSchema,
  location: optionalText(SESSION_LOCATION_MAX),
  startsAt: isoDateTimeWithOffsetSchema,
  endsAt: isoDateTimeWithOffsetSchema,
  timeZone: timeZoneSchema,
  capacity: capacitySchema,
  registrationDeadline: isoDateTimeWithOffsetSchema
    .optional()
    .nullable()
    .transform((value) => (value === "" || value === null ? undefined : value)),
  visibility: z.enum(SESSION_VISIBILITIES).default("class_members"),
  assignmentId: z
    .uuid("Invalid assignment id")
    .optional()
    .nullable()
    .transform((value) => (value === null || value === "" ? undefined : value)),
};

type SessionWindowFields = {
  sessionType: SessionType;
  meetingUrl?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  registrationDeadline?: string;
};

/**
 * Cross-field rules. They mirror the database constraints, so the API returns a
 * field-level message instead of a constraint violation.
 */
function refineSessionWindow(
  value: SessionWindowFields,
  context: z.RefinementCtx,
): void {
  const startsAt = Date.parse(value.startsAt);
  const endsAt = Date.parse(value.endsAt);

  if (Number.isFinite(startsAt) && Number.isFinite(endsAt)) {
    if (endsAt <= startsAt) {
      context.addIssue({
        code: "custom",
        message: "The session must end after it starts",
        path: ["endsAt"],
      });
    } else if (endsAt - startsAt > SESSION_MAX_DURATION_MS) {
      context.addIssue({
        code: "custom",
        message: "A session cannot last longer than 24 hours",
        path: ["endsAt"],
      });
    }

    if (value.registrationDeadline) {
      const deadline = Date.parse(value.registrationDeadline);

      if (Number.isFinite(deadline) && deadline > startsAt) {
        context.addIssue({
          code: "custom",
          message: "Registration must close before the session starts",
          path: ["registrationDeadline"],
        });
      }
    }
  }

  if (value.sessionType === "online" && !value.meetingUrl) {
    context.addIssue({
      code: "custom",
      message: "An online session needs a meeting link",
      path: ["meetingUrl"],
    });
  }

  if (value.sessionType === "in_person" && !value.location) {
    context.addIssue({
      code: "custom",
      message: "An in-person session needs a location",
      path: ["location"],
    });
  }
}

export const sessionCreateSchema = z
  .object({ classId: z.uuid("Choose a class"), ...sessionFields })
  .strict()
  .superRefine(refineSessionWindow);

export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;

export const sessionUpdateSchema = z
  .object(sessionFields)
  .strict()
  .superRefine(refineSessionWindow);

export type SessionUpdateInput = z.infer<typeof sessionUpdateSchema>;

export const sessionStatusUpdateSchema = z
  .object({ status: z.enum(SESSION_STATUSES) })
  .strict();

export type SessionStatusUpdateInput = z.infer<
  typeof sessionStatusUpdateSchema
>;

export const sessionRsvpSchema = z
  .object({ status: z.enum(RSVP_STATUSES) })
  .strict();

export type SessionRsvpInput = z.infer<typeof sessionRsvpSchema>;

const latitudeSchema = z
  .number()
  .min(-90, "Latitude must be between -90 and 90")
  .max(90, "Latitude must be between -90 and 90");

const longitudeSchema = z
  .number()
  .min(-180, "Longitude must be between -180 and 180")
  .max(180, "Longitude must be between -180 and 180");

/**
 * Coordinates and the accuracy radius reported by the browser.
 *
 * The values are self-reported, so this schema only keeps them plausible. The
 * database decides whether the reader is close enough and inside the window.
 */
export const sessionCheckInSchema = z
  .object({
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    accuracy: z
      .number()
      .min(0, "Accuracy must be zero or more")
      .max(
        SESSION_CHECKIN_ACCURACY_MAX_M,
        "Your location is too imprecise. Move somewhere with a clearer signal and try again",
      ),
  })
  .strict();

export type SessionCheckInInput = z.infer<typeof sessionCheckInSchema>;

/** The point an organizer saves while standing in the room. */
export const sessionCheckInLocationSchema = z
  .object({
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    radiusM: z
      .number()
      .int("Radius must be a whole number of metres")
      .min(
        SESSION_CHECKIN_RADIUS_MIN,
        `Radius must be at least ${SESSION_CHECKIN_RADIUS_MIN} metres`,
      )
      .max(
        SESSION_CHECKIN_RADIUS_MAX,
        `Radius must be at most ${SESSION_CHECKIN_RADIUS_MAX} metres`,
      )
      .default(150),
  })
  .strict();

export type SessionCheckInLocationInput = z.infer<
  typeof sessionCheckInLocationSchema
>;

export const sessionCheckInReviewSchema = z
  .object({
    status: z.enum(SESSION_CHECKIN_STATUSES),
    note: z
      .string()
      .trim()
      .max(500, "Keep the note under 500 characters")
      .optional()
      .nullable()
      .transform((value) =>
        value === "" || value === null ? undefined : value,
      ),
  })
  .strict();

export type SessionCheckInReviewInput = z.infer<
  typeof sessionCheckInReviewSchema
>;

/**
 * An organizer recording attendance for one class member, used when the
 * participant could not share a location. The server still verifies that the
 * target belongs to the class.
 */
export const sessionCheckInRecordSchema = z
  .object({
    userId: z.uuid("Choose a class member"),
    status: z.enum(SESSION_CHECKIN_STATUSES),
    note: z
      .string()
      .trim()
      .max(500, "Keep the note under 500 characters")
      .optional()
      .nullable()
      .transform((value) =>
        value === "" || value === null ? undefined : value,
      ),
  })
  .strict();

export type SessionCheckInRecordInput = z.infer<
  typeof sessionCheckInRecordSchema
>;

/**
 * List query. `from`/`to` bound the calendar window; `class` narrows to one
 * class and is always validated as a UUID so it can never be interpolated.
 */
export const sessionListQuerySchema = z.object({
  class: z.uuid("Invalid class id").optional(),
  type: z.enum(SESSION_TYPES).optional(),
  status: z.enum(SESSION_LIST_STATUSES).default("upcoming"),
  from: isoDateTimeWithOffsetSchema.optional(),
  to: isoDateTimeWithOffsetSchema.optional(),
  view: z.enum(SESSION_VIEWS).default("list"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;

/** True when a session can still accept RSVPs at `nowMs`. */
export function isSessionOpenForRsvp(
  session: {
    status: SessionStatus;
    startsAt: string;
    registrationDeadline: string | null;
  },
  nowMs: number,
): boolean {
  if (session.status !== "scheduled") {
    return false;
  }

  const startsAt = Date.parse(session.startsAt);

  if (!Number.isFinite(startsAt) || startsAt <= nowMs) {
    return false;
  }

  if (session.registrationDeadline) {
    const deadline = Date.parse(session.registrationDeadline);

    if (Number.isFinite(deadline) && deadline <= nowMs) {
      return false;
    }
  }

  return true;
}

/** True when a session belongs in an "upcoming" list at `nowMs`. */
export function isSessionUpcoming(
  session: { status: SessionStatus; endsAt: string },
  nowMs: number,
): boolean {
  if (session.status !== "scheduled") {
    return false;
  }

  const endsAt = Date.parse(session.endsAt);

  return Number.isFinite(endsAt) && endsAt > nowMs;
}

/**
 * The window a session accepts check-ins in: 15 minutes before the start until
 * the end. Returns null when the timestamps cannot be parsed.
 *
 * Mirrors `check_in_discussion_session`, which is the only place the rule is
 * enforced; this helper exists so the UI can say "opens at 09:45".
 */
export function getSessionCheckInWindow(
  startsAt: string,
  endsAt: string,
): { opensAt: number; closesAt: number } | null {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  return { opensAt: start - SESSION_CHECKIN_LEAD_MS, closesAt: end };
}

export type SessionCheckInWindowState = "before" | "open" | "closed";

/**
 * Describes the check-in window at `nowMs`. Display only: the database runs the
 * same comparison before it accepts a check-in.
 */
export function getSessionCheckInWindowState(
  startsAt: string,
  endsAt: string,
  nowMs: number,
): SessionCheckInWindowState {
  const window = getSessionCheckInWindow(startsAt, endsAt);

  if (!window) {
    return "closed";
  }

  if (nowMs < window.opensAt) {
    return "before";
  }

  return nowMs > window.closesAt ? "closed" : "open";
}

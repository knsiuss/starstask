import { z } from "zod";

/**
 * In-app feedback contract.
 *
 * The message is the only free-form field. A page path is optional, stored
 * without its query string, and never used to identify a person.
 */

export const FEEDBACK_CATEGORIES = [
  "bug",
  "confusing",
  "idea",
  "other",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Something is broken",
  confusing: "A screen was confusing",
  idea: "An idea for improving StarsTask",
  other: "Something else",
};

export const FEEDBACK_MESSAGE_MIN = 10;
export const FEEDBACK_MESSAGE_MAX = 2000;
export const FEEDBACK_PAGE_PATH_MAX = 200;

export const FEEDBACK_STATUSES = [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "Open",
  reviewing: "Reviewing",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export const feedbackSubmissionSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z
    .string()
    .trim()
    .min(FEEDBACK_MESSAGE_MIN)
    .max(FEEDBACK_MESSAGE_MAX),
  pagePath: z
    .string()
    .trim()
    .max(FEEDBACK_PAGE_PATH_MAX)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>;

export const feedbackIdSchema = z.string().uuid();

export const feedbackStatusUpdateSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
});

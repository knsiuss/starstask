import { describe, expect, it } from "vitest";

import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  FEEDBACK_STATUSES,
  feedbackIdSchema,
  feedbackStatusUpdateSchema,
  feedbackSubmissionSchema,
} from "@starstask/contracts";

describe("feedbackSubmissionSchema", () => {
  it("accepts every category with a message at the minimum length", () => {
    for (const category of FEEDBACK_CATEGORIES) {
      const parsed = feedbackSubmissionSchema.safeParse({
        category,
        message: "x".repeat(FEEDBACK_MESSAGE_MIN),
      });

      expect(parsed.success).toBe(true);
    }
  });

  it("trims the message before measuring it", () => {
    const parsed = feedbackSubmissionSchema.parse({
      category: "bug",
      message: `   ${"a".repeat(FEEDBACK_MESSAGE_MIN)}   `,
    });

    expect(parsed.message).toBe("a".repeat(FEEDBACK_MESSAGE_MIN));
  });

  it("rejects a message that is too short after trimming", () => {
    expect(
      feedbackSubmissionSchema.safeParse({
        category: "bug",
        message: "   short   ",
      }).success,
    ).toBe(false);
  });

  it("rejects a message above the maximum length", () => {
    expect(
      feedbackSubmissionSchema.safeParse({
        category: "idea",
        message: "a".repeat(FEEDBACK_MESSAGE_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(
      feedbackSubmissionSchema.safeParse({
        category: "complaint",
        message: "This category is not part of the contract.",
      }).success,
    ).toBe(false);
  });

  it("drops an empty page path instead of storing it", () => {
    const parsed = feedbackSubmissionSchema.parse({
      category: "confusing",
      message: "The schedule filter did not do what I expected.",
      pagePath: "   ",
    });

    expect(parsed.pagePath).toBeUndefined();
  });

  it("keeps a valid page path", () => {
    const parsed = feedbackSubmissionSchema.parse({
      category: "confusing",
      message: "The schedule filter did not do what I expected.",
      pagePath: "/schedule",
    });

    expect(parsed.pagePath).toBe("/schedule");
  });

  it("rejects a page path above the maximum length", () => {
    expect(
      feedbackSubmissionSchema.safeParse({
        category: "other",
        message: "This page path is far too long to be a real route.",
        pagePath: `/${"a".repeat(200)}`,
      }).success,
    ).toBe(false);
  });
});

describe("feedbackStatusUpdateSchema", () => {
  it("accepts every triage status", () => {
    for (const status of FEEDBACK_STATUSES) {
      expect(feedbackStatusUpdateSchema.safeParse({ status }).success).toBe(
        true,
      );
    }
  });

  it("rejects an unknown status", () => {
    expect(
      feedbackStatusUpdateSchema.safeParse({ status: "archived" }).success,
    ).toBe(false);
  });
});

describe("feedbackIdSchema", () => {
  it("accepts a uuid and rejects a free-form id", () => {
    expect(
      feedbackIdSchema.safeParse("11111111-1111-4111-8111-111111111111")
        .success,
    ).toBe(true);
    expect(feedbackIdSchema.safeParse("feedback-1").success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  assignmentModerationSchema,
  assignmentReviewSchema,
  attachmentIdSchema,
  classApplicationCreateSchema,
  classApplicationDecisionSchema,
  classDeleteSchema,
  classDirectoryQuerySchema,
  classDiscoveryQuerySchema,
  classInvitationAcceptSchema,
  classInvitationCreateSchema,
  classMetadataUpdateSchema,
  classSlugSchema,
  classStatusUpdateSchema,
  classSubmissionCreateSchema,
  EDITABLE_SUBMISSION_STATUSES,
  reviewQueueQuerySchema,
} from "@starstask/contracts";

const validApplication = {
  proposedName: "Database Systems — Class B",
  proposedSlug: "database-systems-b",
  courseName: "Database Systems",
  institution: "Example University",
  lecturerName: "Dr. Example",
  semester: "1",
  academicYear: "2025/2026",
  description: "Weekly database labs and their graded assignments.",
  reason: "I am the class representative and maintain the assignment archive.",
  supportingInfo: undefined,
};

describe("class slug", () => {
  it("normalizes case, whitespace, and rejects unsafe characters", () => {
    expect(classSlugSchema.parse("  Database-Systems-B  ")).toBe(
      "database-systems-b",
    );

    for (const invalid of ["db_lab", "db--lab", "-db", "db-", "db lab", "ab"]) {
      expect(classSlugSchema.safeParse(invalid).success).toBe(false);
    }
  });
});

describe("class application", () => {
  it("accepts a complete application", () => {
    const parsed = classApplicationCreateSchema.safeParse(validApplication);

    expect(parsed.success).toBe(true);
  });

  it("rejects a missing reason and a too-short description", () => {
    const short = classApplicationCreateSchema.safeParse({
      ...validApplication,
      description: "too short",
      reason: "why",
    });

    expect(short.success).toBe(false);
  });

  it("rejects an academic year outside the required format", () => {
    const parsed = classApplicationCreateSchema.safeParse({
      ...validApplication,
      academicYear: "2025-2026",
    });

    expect(parsed.success).toBe(false);
  });

  it("allows an optional institution and lecturer to be omitted", () => {
    const parsed = classApplicationCreateSchema.safeParse({
      ...validApplication,
      institution: undefined,
      lecturerName: undefined,
    });

    expect(parsed.success).toBe(true);
  });
});

describe("class application decision", () => {
  it("requires a note when rejecting", () => {
    expect(
      classApplicationDecisionSchema.safeParse({
        decision: "rejected",
        grantClassAdmin: false,
      }).success,
    ).toBe(false);

    expect(
      classApplicationDecisionSchema.safeParse({
        decision: "rejected",
        note: "The proposal needs a course code.",
        grantClassAdmin: false,
      }).success,
    ).toBe(true);
  });

  it("defaults grantClassAdmin to false on approval", () => {
    const parsed = classApplicationDecisionSchema.safeParse({
      decision: "approved",
      note: "Looks good.",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.grantClassAdmin).toBe(false);
  });

  it("rejects unknown fields so a caller cannot smuggle a role", () => {
    const parsed = classApplicationDecisionSchema.safeParse({
      decision: "approved",
      grantClassAdmin: true,
      grantPlatformAdmin: true,
    });

    expect(parsed.success).toBe(false);
  });
});

describe("class metadata and status", () => {
  it("validates metadata updates", () => {
    expect(
      classMetadataUpdateSchema.safeParse({
        name: "Database Systems — Class B",
        description: "Weekly database labs and their graded assignments.",
        courseName: "Database Systems",
        semester: "1",
        academicYear: "2025/2026",
      }).success,
    ).toBe(true);
  });

  it("only accepts active or archived status", () => {
    expect(
      classStatusUpdateSchema.safeParse({ status: "active" }).success,
    ).toBe(true);
    expect(
      classStatusUpdateSchema.safeParse({ status: "deleted" }).success,
    ).toBe(false);
  });
});

describe("class deletion", () => {
  it("requires the typed class name and trims it", () => {
    const parsed = classDeleteSchema.safeParse({
      confirmName: "  Database Systems — Class B  ",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.confirmName).toBe(
      "Database Systems — Class B",
    );
  });

  it("rejects an empty confirmation", () => {
    expect(classDeleteSchema.safeParse({ confirmName: "   " }).success).toBe(
      false,
    );
  });

  it("rejects unknown fields instead of ignoring them", () => {
    expect(
      classDeleteSchema.safeParse({
        confirmName: "Database Systems — Class B",
        force: true,
      }).success,
    ).toBe(false);
  });

  it("rejects a name longer than the class name limit", () => {
    expect(
      classDeleteSchema.safeParse({ confirmName: "x".repeat(121) }).success,
    ).toBe(false);
  });
});

describe("class invitations", () => {
  it("defaults to a single use and seven days", () => {
    const parsed = classInvitationCreateSchema.safeParse({});

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.maxUses).toBe(1);
    expect(parsed.success && parsed.data.expiresInDays).toBe(7);
  });

  it("bounds the number of uses and the lifetime", () => {
    expect(
      classInvitationCreateSchema.safeParse({ maxUses: "0" }).success,
    ).toBe(false);
    expect(
      classInvitationCreateSchema.safeParse({ maxUses: "501" }).success,
    ).toBe(false);
    expect(
      classInvitationCreateSchema.safeParse({ expiresInDays: "91" }).success,
    ).toBe(false);
  });

  it("validates an optional email restriction", () => {
    expect(
      classInvitationCreateSchema.safeParse({ email: "not-an-email" }).success,
    ).toBe(false);
    expect(
      classInvitationCreateSchema.safeParse({ email: "student@example.test" })
        .success,
    ).toBe(true);
  });

  it("rejects a short acceptance token", () => {
    expect(
      classInvitationAcceptSchema.safeParse({ token: "short" }).success,
    ).toBe(false);
    expect(
      classInvitationAcceptSchema.safeParse({ token: "a".repeat(43) }).success,
    ).toBe(true);
  });
});

describe("class submission", () => {
  it("accepts minimal input and defaults tags and links", () => {
    const parsed = classSubmissionCreateSchema.safeParse({
      title: "Normalization exercise",
      description: "A description long enough for validation.",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.tags).toEqual([]);
    expect(parsed.success && parsed.data.referenceUrls).toEqual([]);
  });

  it("rejects unsafe reference protocols", () => {
    expect(
      classSubmissionCreateSchema.safeParse({
        title: "Normalization exercise",
        description: "A description long enough for validation.",
        referenceUrls: ["javascript:alert(1)"],
      }).success,
    ).toBe(false);
  });

  it("documents the statuses a submitter may revise", () => {
    expect(EDITABLE_SUBMISSION_STATUSES).toContain("rejected");
    expect(EDITABLE_SUBMISSION_STATUSES).toContain("draft");
    expect(EDITABLE_SUBMISSION_STATUSES as readonly string[]).not.toContain(
      "published",
    );
  });
});

describe("assignment review", () => {
  it("does not allow approval without the public confirmation", () => {
    expect(
      assignmentReviewSchema.safeParse({
        decision: "approved",
        confirmPublic: false,
      }).success,
    ).toBe(false);

    expect(
      assignmentReviewSchema.safeParse({
        decision: "approved",
        confirmPublic: true,
      }).success,
    ).toBe(true);
  });

  it("requires a reason to reject", () => {
    expect(
      assignmentReviewSchema.safeParse({
        decision: "rejected",
        confirmPublic: false,
      }).success,
    ).toBe(false);

    expect(
      assignmentReviewSchema.safeParse({
        decision: "rejected",
        reason: "Remove the student names from page two.",
        confirmPublic: false,
      }).success,
    ).toBe(true);
  });
});

describe("assignment moderation", () => {
  it("requires a reason for unpublish and archive", () => {
    expect(
      assignmentModerationSchema.safeParse({ action: "unpublish" }).success,
    ).toBe(false);
    expect(
      assignmentModerationSchema.safeParse({ action: "archive" }).success,
    ).toBe(false);
  });

  it("allows a restore without a reason", () => {
    expect(
      assignmentModerationSchema.safeParse({ action: "restore" }).success,
    ).toBe(true);
  });
});

describe("class discovery query", () => {
  it("defaults paging and drops blank filters", () => {
    const parsed = classDiscoveryQuerySchema.parse({
      search: "",
      semester: "",
    });

    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(12);
    expect(parsed.search).toBeUndefined();
    expect(parsed.semester).toBeUndefined();
  });

  it("bounds the page size", () => {
    expect(
      classDiscoveryQuerySchema.safeParse({ pageSize: "25" }).success,
    ).toBe(false);
  });
});

describe("class directory query", () => {
  it("defaults the ordering and view, and drops blank filters", () => {
    const parsed = classDirectoryQuerySchema.parse({
      search: "",
      semester: "",
    });

    expect(parsed.sort).toBe("newest");
    expect(parsed.view).toBe("grid");
    expect(parsed.search).toBeUndefined();
    expect(parsed.semester).toBeUndefined();
  });

  it("accepts both views and rejects an unknown value", () => {
    expect(classDirectoryQuerySchema.safeParse({ view: "list" }).success).toBe(
      true,
    );
    expect(
      classDirectoryQuerySchema.safeParse({ view: "kanban" }).success,
    ).toBe(false);
  });

  it("rejects an unknown sort", () => {
    expect(
      classDirectoryQuerySchema.safeParse({ sort: "deadline" }).success,
    ).toBe(false);
  });
});

describe("review queue query", () => {
  it("defaults to pending review", () => {
    expect(reviewQueueQuerySchema.parse({}).status).toBe("pending_review");
  });

  it("accepts moderation statuses but not an arbitrary one", () => {
    expect(
      reviewQueueQuerySchema.safeParse({ status: "unpublished" }).success,
    ).toBe(true);
    expect(
      reviewQueueQuerySchema.safeParse({ status: "unknown" }).success,
    ).toBe(false);
  });
});

describe("attachment id", () => {
  it("accepts a uuid and rejects anything else", () => {
    expect(attachmentIdSchema.safeParse(crypto.randomUUID()).success).toBe(
      true,
    );
    expect(attachmentIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

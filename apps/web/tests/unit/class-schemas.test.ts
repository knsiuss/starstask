import { describe, expect, it } from "vitest";

import {
  assignmentModerationSchema,
  assignmentReviewSchema,
  attachmentIdSchema,
  classApplicationCreateSchema,
  classApplicationDecisionSchema,
  classCodeSchema,
  classDeleteSchema,
  classDirectoryQuerySchema,
  classDiscoveryQuerySchema,
  classDuplicateCheckSchema,
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

describe("class code", () => {
  it("normalizes surrounding whitespace and casing", () => {
    expect(classCodeSchema.parse("  tpl-m002  ")).toBe("TPL-M002");
  });

  it("rejects codes that are too short or use unsafe characters", () => {
    for (const invalid of ["A", "TPL#002", "-TPL", "TPL;002"]) {
      expect(classCodeSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it("rejects a code longer than the limit", () => {
    expect(classCodeSchema.safeParse("X".repeat(21)).success).toBe(false);
  });
});

describe("class application", () => {
  it("accepts a complete application", () => {
    const parsed = classApplicationCreateSchema.safeParse(validApplication);

    expect(parsed.success).toBe(true);
  });

  it("normalizes an optional class code and drops a blank one", () => {
    const withCode = classApplicationCreateSchema.safeParse({
      ...validApplication,
      proposedClassCode: "  tpl- m002 ",
    });

    expect(withCode.success && withCode.data.proposedClassCode).toBe(
      "TPL- M002",
    );

    const withoutCode = classApplicationCreateSchema.safeParse({
      ...validApplication,
      proposedClassCode: "   ",
    });

    expect(withoutCode.success && withoutCode.data.proposedClassCode).toBe(
      undefined,
    );
  });

  it("rejects a class code with unsafe characters", () => {
    for (const proposedClassCode of ["A", "TPL#002", "TPL;002"]) {
      expect(
        classApplicationCreateSchema.safeParse({
          ...validApplication,
          proposedClassCode,
        }).success,
      ).toBe(false);
    }
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

  it("defaults approval to an active class and requires explicit duplicate confirmation", () => {
    const parsed = classApplicationDecisionSchema.safeParse({
      decision: "approved",
    });

    expect(parsed.success && parsed.data.initialStatus).toBe("active");
    expect(parsed.success && parsed.data.confirmDuplicate).toBe(false);
  });

  it("lets an approval start as draft and rejects other initial statuses", () => {
    expect(
      classApplicationDecisionSchema.safeParse({
        decision: "approved",
        initialStatus: "draft",
      }).success,
    ).toBe(true);
    expect(
      classApplicationDecisionSchema.safeParse({
        decision: "approved",
        initialStatus: "archived",
      }).success,
    ).toBe(false);
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

  it("accepts an optional join policy and rejects unknown values", () => {
    const base = {
      name: "Database Systems — Class B",
      description: "Weekly database labs and their graded assignments.",
      courseName: "Database Systems",
      semester: "1",
      academicYear: "2025/2026",
    };

    expect(classMetadataUpdateSchema.safeParse(base).success).toBe(true);
    expect(
      classMetadataUpdateSchema.safeParse({ ...base, joinPolicy: "open" })
        .success,
    ).toBe(true);
    expect(
      classMetadataUpdateSchema.safeParse({ ...base, joinPolicy: "invitation" })
        .success,
    ).toBe(true);
    expect(
      classMetadataUpdateSchema.safeParse({ ...base, joinPolicy: "public" })
        .success,
    ).toBe(false);
  });

  it("accepts the three lifecycle statuses and rejects arbitrary ones", () => {
    for (const status of ["draft", "active", "archived"]) {
      expect(classStatusUpdateSchema.safeParse({ status }).success).toBe(true);
    }

    expect(
      classStatusUpdateSchema.safeParse({ status: "deleted" }).success,
    ).toBe(false);
    expect(
      classStatusUpdateSchema.safeParse({
        status: "active",
        force: true,
      }).success,
    ).toBe(false);
  });
});

describe("class duplicate check", () => {
  const base = {
    name: "TPL M002",
    academicYear: "2025/2026",
    semester: "1",
  };

  it("accepts a minimal lookup and normalizes an optional code", () => {
    const parsed = classDuplicateCheckSchema.safeParse({
      ...base,
      classCode: "  tpl-m002 ",
    });

    expect(parsed.success && parsed.data.classCode).toBe("TPL-M002");
  });

  it("accepts an exclude id and an optional institution", () => {
    const parsed = classDuplicateCheckSchema.safeParse({
      ...base,
      institution: "Example University",
      excludeClassId: crypto.randomUUID(),
    });

    expect(parsed.success).toBe(true);
  });

  it("requires name, semester, and a well-formed academic year", () => {
    expect(
      classDuplicateCheckSchema.safeParse({ ...base, name: "" }).success,
    ).toBe(false);
    expect(
      classDuplicateCheckSchema.safeParse({ ...base, semester: "" }).success,
    ).toBe(false);
    expect(
      classDuplicateCheckSchema.safeParse({
        ...base,
        academicYear: "2025-2026",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown fields instead of ignoring them", () => {
    expect(
      classDuplicateCheckSchema.safeParse({ ...base, merge: true }).success,
    ).toBe(false);
  });
});

describe("class deletion", () => {
  it("requires the typed class name and trims it", () => {
    const parsed = classDeleteSchema.safeParse({
      confirm: "  Database Systems — Class B  ",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.confirm).toBe(
      "Database Systems — Class B",
    );
  });

  it("rejects an empty confirmation", () => {
    expect(classDeleteSchema.safeParse({ confirm: "   " }).success).toBe(false);
  });

  it("rejects unknown fields instead of ignoring them", () => {
    expect(
      classDeleteSchema.safeParse({
        confirm: "Database Systems — Class B",
        force: true,
      }).success,
    ).toBe(false);
  });

  it("rejects a name longer than the class name limit", () => {
    expect(
      classDeleteSchema.safeParse({ confirm: "x".repeat(121) }).success,
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
      subjectId: "0b6f1f8e-6f7c-4a1e-9c1d-2f3a4b5c6d7e",
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
        subjectId: "0b6f1f8e-6f7c-4a1e-9c1d-2f3a4b5c6d7e",
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
  it("defaults the ordering, view, and active status and drops blank filters", () => {
    const parsed = classDirectoryQuerySchema.parse({
      search: "",
      semester: "",
      academicYear: "",
    });

    expect(parsed.sort).toBe("newest");
    expect(parsed.view).toBe("grid");
    expect(parsed.status).toBe("active");
    expect(parsed.search).toBeUndefined();
    expect(parsed.semester).toBeUndefined();
    expect(parsed.academicYear).toBeUndefined();
  });

  it("accepts the archived filter and rejects other statuses", () => {
    expect(
      classDirectoryQuerySchema.safeParse({ status: "archived" }).success,
    ).toBe(true);
    expect(
      classDirectoryQuerySchema.safeParse({ status: "draft" }).success,
    ).toBe(false);
  });

  it("accepts an academic year and rejects a malformed one", () => {
    expect(
      classDirectoryQuerySchema.safeParse({ academicYear: "2025/2026" })
        .success,
    ).toBe(true);
    expect(
      classDirectoryQuerySchema.safeParse({ academicYear: "2025-2026" })
        .success,
    ).toBe(false);
  });

  it("accepts both views and rejects unknown values", () => {
    expect(classDirectoryQuerySchema.safeParse({ view: "list" }).success).toBe(
      true,
    );
    expect(
      classDirectoryQuerySchema.safeParse({ view: "kanban" }).success,
    ).toBe(false);
    expect(
      classDirectoryQuerySchema.safeParse({ sort: "kanban" }).success,
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

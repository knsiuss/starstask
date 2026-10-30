import { describe, expect, it } from "vitest";

import {
  VERIFICATION_STATUS_LABELS,
  declaredPositionUpdateSchema,
  verificationDecisionSchema,
  verificationQueueQuerySchema,
  verificationRequestCreateSchema,
  verificationRequestReviseSchema,
  verificationRevokeSchema,
} from "@starstask/contracts";

/**
 * These schemas are the browser-facing half of the verification boundary. The
 * database repeats the important checks, but a malformed payload should be
 * rejected before it ever reaches storage or a role assignment.
 */

const CLASS_ID = "6f1a6d3e-0000-4000-8000-000000000001";

describe("declaredPositionUpdateSchema", () => {
  it("accepts the two documented positions", () => {
    expect(
      declaredPositionUpdateSchema.safeParse({ position: "student" }).success,
    ).toBe(true);
    expect(
      declaredPositionUpdateSchema.safeParse({
        position: "class_representative",
      }).success,
    ).toBe(true);
  });

  it("rejects anything that looks like a role", () => {
    for (const position of ["class_admin", "platform_admin", "admin", ""]) {
      expect(declaredPositionUpdateSchema.safeParse({ position }).success).toBe(
        false,
      );
    }
  });

  it("rejects a smuggled user id", () => {
    const result = declaredPositionUpdateSchema.safeParse({
      position: "class_representative",
      userId: "6f1a6d3e-0000-4000-8000-000000000099",
    });

    expect(result.success).toBe(false);
  });
});

describe("verificationRequestCreateSchema", () => {
  it("turns an empty explanation into null", () => {
    const result = verificationRequestCreateSchema.parse({
      classId: CLASS_ID,
      statement: "   ",
    });

    expect(result.statement).toBeNull();
  });

  it("trims and keeps a real explanation", () => {
    const result = verificationRequestCreateSchema.parse({
      classId: CLASS_ID,
      statement: "  Elected as ketua kelas in week two.  ",
    });

    expect(result.statement).toBe("Elected as ketua kelas in week two.");
  });

  it("rejects a too-short explanation", () => {
    const result = verificationRequestCreateSchema.safeParse({
      classId: CLASS_ID,
      statement: "ketua",
    });

    expect(result.success).toBe(false);
  });

  it("requires a uuid class id", () => {
    expect(
      verificationRequestCreateSchema.safeParse({
        classId: "class-1",
        statement: null,
      }).success,
    ).toBe(false);
  });
});

describe("verificationRequestReviseSchema", () => {
  it("allows clearing the explanation", () => {
    const result = verificationRequestReviseSchema.parse({ statement: "" });

    expect(result.statement).toBeNull();
  });
});

describe("verificationDecisionSchema", () => {
  it("requires an explicit grant confirmation for approval", () => {
    expect(
      verificationDecisionSchema.safeParse({
        decision: "approve",
        confirmGrant: false,
      }).success,
    ).toBe(false);

    expect(
      verificationDecisionSchema.safeParse({
        decision: "approve",
        confirmGrant: true,
      }).success,
    ).toBe(true);
  });

  it("requires a note for rejection and revision", () => {
    for (const decision of ["reject", "request_revision"]) {
      expect(
        verificationDecisionSchema.safeParse({
          decision,
          note: "",
          confirmGrant: false,
        }).success,
      ).toBe(false);

      expect(
        verificationDecisionSchema.safeParse({
          decision,
          note: "Explain the evidence",
          confirmGrant: false,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects an unknown decision", () => {
    expect(
      verificationDecisionSchema.safeParse({
        decision: "grant_admin",
        confirmGrant: true,
      }).success,
    ).toBe(false);
  });
});

describe("verificationRevokeSchema", () => {
  it("requires both a reason and a confirmation", () => {
    expect(
      verificationRevokeSchema.safeParse({ note: "", confirmRevoke: true })
        .success,
    ).toBe(false);

    expect(
      verificationRevokeSchema.safeParse({
        note: "No longer the class representative",
        confirmRevoke: false,
      }).success,
    ).toBe(false);

    expect(
      verificationRevokeSchema.safeParse({
        note: "No longer the class representative",
        confirmRevoke: true,
      }).success,
    ).toBe(true);
  });
});

describe("verificationQueueQuerySchema", () => {
  it("defaults to the pending queue", () => {
    const result = verificationQueueQuerySchema.parse({});

    expect(result.status).toBe("pending");
    expect(result.page).toBe(1);
  });

  it("accepts every filter", () => {
    const result = verificationQueueQuerySchema.parse({
      search: "Rina",
      status: "all",
      class: CLASS_ID,
      semester: "Ganjil 2026",
      page: "2",
      pageSize: "50",
    });

    expect(result.status).toBe("all");
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(50);
  });

  it("rejects an unknown status", () => {
    expect(
      verificationQueueQuerySchema.safeParse({ status: "approved" }).success,
    ).toBe(false);
  });
});

describe("VERIFICATION_STATUS_LABELS", () => {
  it("labels every status distinctly", () => {
    const labels = Object.values(VERIFICATION_STATUS_LABELS);

    expect(labels).toHaveLength(4);
    expect(new Set(labels).size).toBe(4);
    expect(labels.every((label) => label.length > 0)).toBe(true);
  });
});

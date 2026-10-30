import { describe, expect, it } from "vitest";

import {
  LEAVE_FORWARDING_MAX_REQUESTS,
  leaveForwardingRequestSchema,
  leaveForwardingSchema,
} from "@starstask/contracts";

/**
 * Forwarding payload rules.
 *
 * These guard the shape only — authorization and the "is it still submitted"
 * check happen in the database function. What matters here is that a malformed
 * or duplicated selection never reaches it.
 */

function uid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

const CLASS_ID = "6f1a6d3e-0000-4000-8000-0000000000aa";

const VALID = {
  classId: CLASS_ID,
  requestIds: [uid(1), uid(2)],
  recipientName: "Dr. Tan",
  recipientEmail: "",
  reportFormat: "summary" as const,
  idempotencyKey: "3f2b1a00-0000-4000-8000-0000000000ff",
};

/** The same payload without the class, as the route receives it. */
const VALID_BODY = {
  requestIds: VALID.requestIds,
  recipientName: VALID.recipientName,
  recipientEmail: VALID.recipientEmail,
  reportFormat: VALID.reportFormat,
  idempotencyKey: VALID.idempotencyKey,
};

describe("leaveForwardingSchema", () => {
  it("accepts a valid package", () => {
    const parsed = leaveForwardingSchema.safeParse(VALID);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.recipientEmail).toBeNull();
      expect(parsed.data.requestIds).toHaveLength(2);
    }
  });

  it("requires a class, because the server needs to scope the package", () => {
    expect(leaveForwardingSchema.safeParse(VALID_BODY).success).toBe(false);
  });

  it("rejects an empty selection", () => {
    expect(
      leaveForwardingSchema.safeParse({ ...VALID, requestIds: [] }).success,
    ).toBe(false);
  });

  it("rejects a duplicate request in the same package", () => {
    // A request may only ever join one package, so a duplicate is a bug or an
    // attempt to double-count.
    const parsed = leaveForwardingSchema.safeParse({
      ...VALID,
      requestIds: [uid(1), uid(1)],
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(
        "The selection contains duplicates",
      );
    }
  });

  it("rejects more requests than one package may carry", () => {
    const tooMany = Array.from(
      { length: LEAVE_FORWARDING_MAX_REQUESTS + 1 },
      (_, index) => uid(index + 1),
    );

    expect(
      leaveForwardingSchema.safeParse({ ...VALID, requestIds: tooMany })
        .success,
    ).toBe(false);
  });

  it("accepts exactly the maximum", () => {
    const exact = Array.from(
      { length: LEAVE_FORWARDING_MAX_REQUESTS },
      (_, index) => uid(index + 1),
    );

    expect(
      leaveForwardingSchema.safeParse({ ...VALID, requestIds: exact }).success,
    ).toBe(true);
  });

  it("requires the lecturer's name", () => {
    expect(
      leaveForwardingSchema.safeParse({ ...VALID, recipientName: "  " })
        .success,
    ).toBe(false);
  });

  it("accepts an omitted email but rejects a malformed one", () => {
    expect(
      leaveForwardingSchema.safeParse({ ...VALID, recipientEmail: "" }).success,
    ).toBe(true);
    expect(
      leaveForwardingSchema.safeParse({
        ...VALID,
        recipientEmail: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown report format", () => {
    expect(
      leaveForwardingSchema.safeParse({ ...VALID, reportFormat: "excel" })
        .success,
    ).toBe(false);
  });

  it("requires an idempotency key long enough to be unique", () => {
    expect(
      leaveForwardingSchema.safeParse({ ...VALID, idempotencyKey: "short" })
        .success,
    ).toBe(false);
  });

  it("drops any status a client tries to inject", () => {
    // A caller must never be able to say a request is forwarded; only the
    // database function decides that after the package is built.
    const parsed = leaveForwardingSchema.safeParse({
      ...VALID,
      status: "forwarded",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("status");
    }
  });
});

describe("leaveForwardingRequestSchema", () => {
  it("does not accept a class from the body", () => {
    // The class comes from the URL slug, so a body value is ignored rather than
    // trusted.
    const parsed = leaveForwardingRequestSchema.safeParse(VALID);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("classId");
    }
  });

  it("still rejects a duplicate selection", () => {
    expect(
      leaveForwardingRequestSchema.safeParse({
        ...VALID_BODY,
        requestIds: [uid(3), uid(3)],
      }).success,
    ).toBe(false);
  });
});

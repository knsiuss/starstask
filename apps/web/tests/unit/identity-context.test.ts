import { describe, expect, it } from "vitest";

import {
  deriveIdentityContext,
  type DeriveIdentityInput,
  type MembershipRow,
  type UniversityRow,
} from "@/lib/identity/derive-identity-context";

const university = (overrides: Partial<UniversityRow> = {}): UniversityRow => ({
  id: "uni-1",
  slug: "univ-1",
  name: "University One",
  short_name: "U1",
  status: "active",
  timezone: "Asia/Jakarta",
  ...overrides,
});

const membership = (overrides: Partial<MembershipRow> = {}): MembershipRow => ({
  id: "mem-1",
  university_id: "uni-1",
  role: "student",
  status: "active",
  entry_year: 2024,
  student_id: "220110001",
  ...overrides,
});

const input = (
  overrides: Partial<DeriveIdentityInput> = {},
): DeriveIdentityInput => ({
  hasProfile: true,
  memberships: [],
  universities: [],
  identities: [],
  ...overrides,
});

describe("deriveIdentityContext", () => {
  it("returns missing_profile before looking at memberships", () => {
    const context = deriveIdentityContext(
      input({
        hasProfile: false,
        memberships: [membership()],
        universities: [university()],
      }),
    );

    expect(context.status).toBe("missing_profile");
  });

  it("returns no_membership when the user has no membership rows", () => {
    expect(deriveIdentityContext(input()).status).toBe("no_membership");
  });

  it("returns no_active_membership when every persona is pending", () => {
    const context = deriveIdentityContext(
      input({ memberships: [membership({ status: "pending" })] }),
    );

    expect(context.status).toBe("no_active_membership");
  });

  it("returns no_active_membership when the only persona is suspended", () => {
    const context = deriveIdentityContext(
      input({
        memberships: [membership({ status: "suspended" })],
        universities: [university()],
      }),
    );

    expect(context.status).toBe("no_active_membership");
  });

  it("returns no_active_membership for graduated personas", () => {
    const context = deriveIdentityContext(
      input({
        memberships: [membership({ status: "graduated" })],
        universities: [university()],
      }),
    );

    expect(context.status).toBe("no_active_membership");
  });

  it("never picks one when two active memberships exist", () => {
    const context = deriveIdentityContext(
      input({
        memberships: [
          membership({ id: "mem-1", university_id: "uni-1" }),
          membership({ id: "mem-2", university_id: "uni-2" }),
        ],
        universities: [
          university({ id: "uni-1" }),
          university({ id: "uni-2", slug: "univ-2", name: "University Two" }),
        ],
      }),
    );

    expect(context.status).toBe("multiple_active_memberships");

    if (context.status === "multiple_active_memberships") {
      expect(context.memberships.map((row) => row.id)).toEqual([
        "mem-1",
        "mem-2",
      ]);
    }
  });

  it("treats a missing university row as inactive (RLS hides non-active rows)", () => {
    const context = deriveIdentityContext(
      input({
        memberships: [membership()],
        universities: [],
      }),
    );

    expect(context.status).toBe("inactive_university");
  });

  it("treats a suspended university row as inactive", () => {
    const context = deriveIdentityContext(
      input({
        memberships: [membership()],
        universities: [university({ status: "suspended" })],
      }),
    );

    expect(context.status).toBe("inactive_university");
  });

  it("returns active with the academic identity when fully wired", () => {
    const context = deriveIdentityContext(
      input({
        memberships: [membership()],
        universities: [university()],
        identities: [
          {
            id: "identity-1",
            university_membership_id: "mem-1",
            academic_unit_id: "unit-1",
            student_id: "220110001",
            entry_year: 2024,
            status: "active",
          },
        ],
      }),
    );

    expect(context.status).toBe("active");

    if (context.status === "active") {
      expect(context.university.name).toBe("University One");
      expect(context.identity?.studentId).toBe("220110001");
      expect(context.identity?.status).toBe("active");
    }
  });

  it("returns active with identity null when the persona is not provisioned", () => {
    const context = deriveIdentityContext(
      input({
        memberships: [membership()],
        universities: [university()],
        identities: [],
      }),
    );

    expect(context.status).toBe("active");

    if (context.status === "active") {
      expect(context.identity).toBeNull();
    }
  });

  it("ignores identities that belong to a different membership", () => {
    const context = deriveIdentityContext(
      input({
        memberships: [membership()],
        universities: [university()],
        identities: [
          {
            id: "identity-2",
            university_membership_id: "mem-other",
            academic_unit_id: null,
            student_id: "999999999",
            entry_year: null,
            status: "active",
          },
        ],
      }),
    );

    expect(context.status).toBe("active");

    if (context.status === "active") {
      expect(context.identity).toBeNull();
    }
  });

  it("keeps the mixed case (one active + one suspended) on the active path", () => {
    const context = deriveIdentityContext(
      input({
        memberships: [
          membership({ id: "mem-1", university_id: "uni-1", status: "active" }),
          membership({
            id: "mem-2",
            university_id: "uni-2",
            status: "suspended",
          }),
        ],
        universities: [university({ id: "uni-1" })],
      }),
    );

    expect(context.status).toBe("active");

    if (context.status === "active") {
      expect(context.membership.id).toBe("mem-1");
    }
  });
});

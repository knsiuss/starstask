import { describe, expect, it } from "vitest";

import {
  classInvitationDeclineSchema,
  classMembersQuerySchema,
  classSubjectCreateSchema,
  classSubjectUpdateSchema,
  subjectIdSchema,
} from "@starstask/contracts";

describe("subjectIdSchema", () => {
  it("accepts valid UUID strings", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";
    expect(subjectIdSchema.safeParse(validUuid).success).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    expect(subjectIdSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(subjectIdSchema.safeParse("").success).toBe(false);
  });
});

describe("classSubjectCreateSchema", () => {
  it("accepts valid subject creation input", () => {
    const input = {
      name: "Pemrograman Web",
      code: "IF201",
      lecturerName: "Dr. Budi Santoso",
      description: "Belajar HTML, CSS, JavaScript, dan backend",
    };
    const parsed = classSubjectCreateSchema.safeParse(input);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Pemrograman Web");
      expect(parsed.data.code).toBe("IF201");
    }
  });

  it("trims subject name and rejects empty or short names", () => {
    expect(
      classSubjectCreateSchema.safeParse({
        name: "   ",
      }).success,
    ).toBe(false);

    expect(
      classSubjectCreateSchema.safeParse({
        name: "A",
      }).success,
    ).toBe(false);
  });

  it("allows omitting optional fields", () => {
    const input = { name: "Basis Data" };
    const parsed = classSubjectCreateSchema.safeParse(input);

    expect(parsed.success).toBe(true);
  });

  it("rejects names exceeding 120 characters", () => {
    const longName = "A".repeat(121);
    expect(
      classSubjectCreateSchema.safeParse({
        name: longName,
      }).success,
    ).toBe(false);
  });
});

describe("classSubjectUpdateSchema", () => {
  it("accepts partial updates", () => {
    const parsed = classSubjectUpdateSchema.safeParse({
      name: "Pemrograman Web Lanjutan",
      status: "archived",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts empty object for no-op update", () => {
    expect(classSubjectUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(
      classSubjectUpdateSchema.safeParse({
        status: "deleted",
      }).success,
    ).toBe(false);
  });
});

describe("classMembersQuerySchema", () => {
  it("defaults pagination to page 1 and size 20", () => {
    const parsed = classMembersQuerySchema.parse({});

    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
  });

  it("trims search string and transforms empty string to undefined", () => {
    const parsed = classMembersQuerySchema.parse({
      search: "  John Doe  ",
    });
    expect(parsed.search).toBe("John Doe");

    const emptyParsed = classMembersQuerySchema.parse({
      search: "   ",
    });
    expect(emptyParsed.search).toBeUndefined();
  });
});

describe("classInvitationDeclineSchema", () => {
  it("accepts valid invitation ID", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";
    const parsed = classInvitationDeclineSchema.safeParse({
      invitationId: validUuid,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid invitation ID", () => {
    expect(
      classInvitationDeclineSchema.safeParse({
        invitationId: "invalid",
      }).success,
    ).toBe(false);
  });
});

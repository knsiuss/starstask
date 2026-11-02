import { describe, expect, it } from "vitest";

import {
  classInvitationDeclineSchema,
  classMembersQuerySchema,
  classSubjectCreateSchema,
  classSubjectUpdateSchema,
  courseMaterialCreateSchema,
  courseMaterialUpdateSchema,
  subjectIdSchema,
} from "@starstask/contracts";

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

const materialInput = {
  subjectId: COURSE_ID,
  title: "Minggu 3 — Normalization",
  description: "Slides and exercises for third-week normalization.",
};

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

describe("courseMaterialCreateSchema", () => {
  it("accepts a material with written content", () => {
    const parsed = courseMaterialCreateSchema.safeParse(materialInput);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.kind).toBe("document");
      expect(parsed.data.resourceUrl).toBeUndefined();
    }
  });

  it("requires a course", () => {
    expect(
      courseMaterialCreateSchema.safeParse({
        title: materialInput.title,
        description: materialInput.description,
      }).success,
    ).toBe(false);
  });

  it("requires either a description or an https link", () => {
    expect(
      courseMaterialCreateSchema.safeParse({
        subjectId: COURSE_ID,
        title: materialInput.title,
      }).success,
    ).toBe(false);

    expect(
      courseMaterialCreateSchema.safeParse({
        subjectId: COURSE_ID,
        title: materialInput.title,
        resourceUrl: "https://example.test/materi.pdf",
      }).success,
    ).toBe(true);
  });

  it("rejects non-https links and unknown kinds", () => {
    expect(
      courseMaterialCreateSchema.safeParse({
        ...materialInput,
        resourceUrl: "http://example.test/materi.pdf",
      }).success,
    ).toBe(false);

    expect(
      courseMaterialCreateSchema.safeParse({
        ...materialInput,
        kind: "spreadsheet",
      }).success,
    ).toBe(false);
  });

  it("rejects a title shorter than three characters", () => {
    expect(
      courseMaterialCreateSchema.safeParse({
        ...materialInput,
        title: "A",
      }).success,
    ).toBe(false);
  });
});

describe("courseMaterialUpdateSchema", () => {
  it("applies the same ownership and content rules", () => {
    expect(courseMaterialUpdateSchema.safeParse(materialInput).success).toBe(
      true,
    );
    expect(
      courseMaterialUpdateSchema.safeParse({
        title: materialInput.title,
        description: materialInput.description,
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

import { describe, expect, it } from "vitest";

import {
  ASSIGNMENT_CONTENT_TYPE_LABELS,
  ASSIGNMENT_CONTENT_TYPES,
  assignmentCompletionSchema,
  classSubmissionCreateSchema,
  classSubmissionReviseSchema,
  isGoogleDriveUrl,
} from "@starstask/contracts";

const baseSubmission = {
  title: "Essay on distributed systems",
  description: "Write 1500 words about consensus protocols.",
  subjectId: "0b6f1f8e-6f7c-4a1e-9c1d-2f3a4b5c6d7e",
};

describe("assignment content types", () => {
  it("exposes exactly the two documented kinds", () => {
    expect([...ASSIGNMENT_CONTENT_TYPES]).toEqual([
      "lecturer_assignment",
      "class_announcement",
    ]);
  });

  it("labels both kinds without claiming verification", () => {
    for (const contentType of ASSIGNMENT_CONTENT_TYPES) {
      expect(ASSIGNMENT_CONTENT_TYPE_LABELS[contentType]).toBeTruthy();
      expect(ASSIGNMENT_CONTENT_TYPE_LABELS[contentType]).not.toMatch(
        /verified|official/i,
      );
    }
  });

  it("defaults a class submission to a lecturer assignment", () => {
    const parsed = classSubmissionCreateSchema.parse(baseSubmission);

    expect(parsed.contentType).toBe("lecturer_assignment");
    expect(parsed.sourceLabel).toBeNull();
    expect(parsed.driveUrl).toBeNull();
  });

  it("accepts an explicit class announcement", () => {
    const parsed = classSubmissionCreateSchema.parse({
      ...baseSubmission,
      contentType: "class_announcement",
    });

    expect(parsed.contentType).toBe("class_announcement");
  });

  it("rejects an unknown content type", () => {
    const result = classSubmissionCreateSchema.safeParse({
      ...baseSubmission,
      contentType: "homework",
    });

    expect(result.success).toBe(false);
  });

  it("treats an empty source label as absent", () => {
    const parsed = classSubmissionCreateSchema.parse({
      ...baseSubmission,
      sourceLabel: "   ",
    });

    expect(parsed.sourceLabel).toBeNull();
  });

  it("keeps a real source label", () => {
    const parsed = classSubmissionCreateSchema.parse({
      ...baseSubmission,
      sourceLabel: "  Dr. Ani Wijaya ",
    });

    expect(parsed.sourceLabel).toBe("Dr. Ani Wijaya");
  });

  it("requires a course when creating class content", () => {
    expect(
      classSubmissionCreateSchema.safeParse({
        title: baseSubmission.title,
        description: baseSubmission.description,
      }).success,
    ).toBe(false);
  });

  it("lets a revision keep the course it was created with", () => {
    expect(
      classSubmissionReviseSchema.safeParse({
        title: baseSubmission.title,
        description: baseSubmission.description,
      }).success,
    ).toBe(true);
    expect(classSubmissionReviseSchema.safeParse(baseSubmission).success).toBe(
      true,
    );
  });
});

describe("Google Drive links", () => {
  it("accepts Drive and Docs https links", () => {
    expect(isGoogleDriveUrl("https://drive.google.com/file/d/abc/view")).toBe(
      true,
    );
    expect(
      isGoogleDriveUrl("https://docs.google.com/document/d/abc/edit"),
    ).toBe(true);
  });

  it("rejects look-alike hosts and other schemes", () => {
    expect(isGoogleDriveUrl("http://drive.google.com/file/d/abc")).toBe(false);
    expect(isGoogleDriveUrl("https://drive.google.com.evil.test/x")).toBe(
      false,
    );
    expect(isGoogleDriveUrl("https://example.com/drive")).toBe(false);
    expect(isGoogleDriveUrl("javascript:alert(1)")).toBe(false);
  });

  it("stores a valid link on the submission", () => {
    const parsed = classSubmissionCreateSchema.parse({
      ...baseSubmission,
      driveUrl: "https://drive.google.com/drive/folders/xyz",
    });

    expect(parsed.driveUrl).toBe("https://drive.google.com/drive/folders/xyz");
  });

  it("rejects a non-Drive link with a field message", () => {
    const result = classSubmissionCreateSchema.safeParse({
      ...baseSubmission,
      driveUrl: "https://example.com/not-drive",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("driveUrl");
    }
  });

  it("treats an empty string as no link", () => {
    const parsed = classSubmissionCreateSchema.parse({
      ...baseSubmission,
      driveUrl: "",
    });

    expect(parsed.driveUrl).toBeNull();
  });
});

describe("personal completion payload", () => {
  it("requires a boolean and nothing else", () => {
    expect(assignmentCompletionSchema.parse({ completed: true })).toEqual({
      completed: true,
    });
    expect(
      assignmentCompletionSchema.safeParse({ completed: "yes" }).success,
    ).toBe(false);
    expect(assignmentCompletionSchema.safeParse({}).success).toBe(false);
    expect(
      assignmentCompletionSchema.safeParse({ completed: true, grade: 90 })
        .success,
    ).toBe(false);
  });
});

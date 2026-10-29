import { describe, expect, it } from "vitest";

import {
  collectFiles,
  isHoneypotTripped,
  parseAssignmentForm,
} from "@/lib/api/assignment-payload";

function buildForm(entries: Record<string, string>): FormData {
  const form = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    form.set(key, value);
  }

  return form;
}

describe("parseAssignmentForm", () => {
  it("maps text fields and parses JSON arrays", () => {
    const form = buildForm({
      title: "Quiz 1",
      description: "Answer every question.",
      courseName: "Algorithms",
      tags: '["graphs","sorting"]',
      referenceUrls: '["https://example.com"]',
    });

    const payload = parseAssignmentForm(form);

    expect(payload.title).toBe("Quiz 1");
    expect(payload.tags).toEqual(["graphs", "sorting"]);
    expect(payload.referenceUrls).toEqual(["https://example.com"]);
  });

  it("falls back to delimiter parsing for non-JSON lists", () => {
    const form = buildForm({ tags: "graphs, sorting\ndp" });

    expect(parseAssignmentForm(form).tags).toEqual(["graphs", "sorting", "dp"]);
  });

  it("returns an empty array for a missing list", () => {
    const form = buildForm({ title: "Quiz" });

    expect(parseAssignmentForm(form).tags).toEqual([]);
  });

  it("normalizes an empty enum to undefined", () => {
    const form = buildForm({ assignmentType: "   " });

    expect(parseAssignmentForm(form).assignmentType).toBeUndefined();
  });
});

describe("collectFiles", () => {
  it("drops empty file inputs", () => {
    const form = new FormData();
    form.append("files", new File([], "empty.pdf"));
    form.append("files", new File([new Uint8Array([1])], "real.pdf"));

    const files = collectFiles(form);

    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe("real.pdf");
  });
});

describe("isHoneypotTripped", () => {
  it("is false when the hidden field is empty", () => {
    expect(isHoneypotTripped(buildForm({ website: "" }))).toBe(false);
  });

  it("is true when a bot fills the hidden field", () => {
    expect(isHoneypotTripped(buildForm({ website: "http://spam" }))).toBe(true);
  });
});

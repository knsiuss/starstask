import { describe, expect, it } from "vitest";

import {
  classJoinResultSchema,
  maskNim,
  myProfileSchema,
  normalizeClassKey,
  profileOnboardingSchema,
} from "@starstask/contracts";

const validProfile = {
  fullName: "Ada Lovelace",
  nickname: "Ada",
  nim: "2024010767",
  university: "Universitas Contoh",
  className: "IF-24-01",
};

describe("class name normalization", () => {
  it("treats case, surrounding whitespace, and separators as the same name", () => {
    const expected = normalizeClassKey("IF-24-01");

    for (const input of [
      "IF-24-01",
      "if-24-01",
      " if-24-01 ",
      "IF 24 01",
      "IF_24_01",
      "IF.24.01",
      "\tIF-24-01\n",
      "iF  24--01",
    ]) {
      expect(normalizeClassKey(input)).toBe(expected);
    }

    expect(expected).toBe("if2401");
  });

  it("does not merge genuinely different identifiers", () => {
    expect(normalizeClassKey("IF-24-01")).not.toBe(
      normalizeClassKey("IF-24-1"),
    );
    expect(normalizeClassKey("IF-24-01")).not.toBe(
      normalizeClassKey("IF-24-02"),
    );
    expect(normalizeClassKey("IF-24-01")).not.toBe(
      normalizeClassKey("IF-24-011"),
    );
  });

  it("returns null for empty and separator-only input", () => {
    for (const input of ["", "   ", "-", " -- ", "...", "\t\n"]) {
      expect(normalizeClassKey(input)).toBeNull();
    }
  });
});

describe("NIM masking", () => {
  it("reveals only the last four characters of a long NIM", () => {
    expect(maskNim("2024010767")).toBe("******0767");
    expect(maskNim("202401076712")).toBe("********6712");
  });

  it("masks a short NIM completely instead of revealing most of it", () => {
    expect(maskNim("1234")).toBe("****");
    expect(maskNim("123456")).toBe("******");
    expect(maskNim("")).toBe("");
  });
});

describe("onboarding schema", () => {
  it("accepts a complete profile and keeps a leading-zero NIM as text", () => {
    const parsed = profileOnboardingSchema.safeParse({
      ...validProfile,
      nim: "0012345",
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.nim).toBe("0012345");
    }
  });

  it("treats an empty class name as absent", () => {
    const parsed = profileOnboardingSchema.safeParse({
      ...validProfile,
      className: "   ",
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.className).toBeUndefined();
    }
  });

  it("requires the four mandatory fields", () => {
    for (const key of ["fullName", "nickname", "nim", "university"] as const) {
      const parsed = profileOnboardingSchema.safeParse({
        ...validProfile,
        [key]: "",
      });

      expect(parsed.success).toBe(false);
    }
  });

  it("rejects a NIM with whitespace or unsupported symbols", () => {
    for (const nim of ["2024 0107", "2024/0107", "2024@0107", "20"]) {
      expect(
        profileOnboardingSchema.safeParse({ ...validProfile, nim }).success,
      ).toBe(false);
    }
  });
});

describe("join result schema", () => {
  it("parses a matched outcome with a class identity", () => {
    const parsed = classJoinResultSchema.safeParse({
      status: "joined",
      classId: "11111111-1111-1111-1111-111111111111",
      slug: "if-24-01",
      name: "IF 24 01",
    });

    expect(parsed.success).toBe(true);
  });

  it("parses no-match and ambiguous outcomes", () => {
    expect(
      classJoinResultSchema.safeParse({ status: "no_match" }).success,
    ).toBe(true);
    expect(
      classJoinResultSchema.safeParse({
        status: "ambiguous",
        candidates: [{ id: "a", slug: "a", name: "A" }],
      }).success,
    ).toBe(true);
  });

  it("rejects an ambiguous outcome with no candidates and an unknown status", () => {
    expect(
      classJoinResultSchema.safeParse({ status: "ambiguous", candidates: [] })
        .success,
    ).toBe(false);
    expect(classJoinResultSchema.safeParse({ status: "joined" }).success).toBe(
      false,
    );
  });
});

describe("my profile payload", () => {
  it("parses the owner payload including private fields", () => {
    const parsed = myProfileSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      fullName: "Ada Lovelace",
      nickname: "Ada",
      nim: "0012345",
      university: "Universitas Contoh",
      declaredClassName: null,
      avatarUrl: null,
      onboardedAt: "2026-10-29T00:00:00.000Z",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a payload without the owner id", () => {
    expect(myProfileSchema.safeParse({ nickname: "Ada" }).success).toBe(false);
  });
});

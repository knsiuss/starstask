import { describe, expect, it } from "vitest";

import {
  myProfileSchema,
  PROFILE_BIO_MAX,
  profileBioSchema,
} from "@starstask/contracts";

describe("profile bio schema", () => {
  it("clears the bio when the submitted text is empty or whitespace", () => {
    for (const bio of ["", "   ", "\n\t"]) {
      const parsed = profileBioSchema.safeParse({ bio });

      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.bio).toBeNull();
      }
    }
  });

  it("trims a saved bio and keeps its line breaks", () => {
    const parsed = profileBioSchema.safeParse({
      bio: "  Informatics student.\nLikes databases.  ",
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.bio).toBe("Informatics student.\nLikes databases.");
    }
  });

  it("rejects a bio longer than the limit", () => {
    expect(
      profileBioSchema.safeParse({ bio: "a".repeat(PROFILE_BIO_MAX + 1) })
        .success,
    ).toBe(false);
  });

  it("defaults a missing bio to null in the owner payload", () => {
    const parsed = myProfileSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      fullName: "Ada Lovelace",
      nickname: "Ada",
      nim: "0012345",
      university: "Universitas Contoh",
      declaredClassName: null,
      avatarUrl: null,
      onboardedAt: null,
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.bio).toBeNull();
    }
  });
});

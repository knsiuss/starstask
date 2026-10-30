import { describe, expect, it } from "vitest";

import { extractInvitationToken } from "@/lib/utils/invitation-link";

// 43 base64url characters, the shape `randomBytes(32).toString("base64url")` produces.
const INVITE_SEGMENT = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v";

describe("extractInvitationToken", () => {
  it("returns a bare token unchanged", () => {
    expect(extractInvitationToken(INVITE_SEGMENT)).toBe(INVITE_SEGMENT);
  });

  it("accepts an absolute invite link", () => {
    expect(
      extractInvitationToken(`https://starstask.app/invite/${INVITE_SEGMENT}`),
    ).toBe(INVITE_SEGMENT);
  });

  it("accepts a site-relative invite link", () => {
    expect(extractInvitationToken(`/invite/${INVITE_SEGMENT}`)).toBe(INVITE_SEGMENT);
  });

  it("accepts a protocol-relative link and ignores query strings", () => {
    expect(
      extractInvitationToken(`//starstask.app/invite/${INVITE_SEGMENT}?from=email`),
    ).toBe(INVITE_SEGMENT);
  });

  it("trims surrounding whitespace", () => {
    expect(extractInvitationToken(`  ${INVITE_SEGMENT}\n`)).toBe(INVITE_SEGMENT);
  });

  it("returns null for blank input", () => {
    expect(extractInvitationToken("")).toBeNull();
    expect(extractInvitationToken("   ")).toBeNull();
  });

  it("returns null for a link without a token segment", () => {
    expect(extractInvitationToken("https://starstask.app/classes")).toBeNull();
    expect(extractInvitationToken("/invite/")).toBeNull();
  });

  it("returns null for a token that is too short or has unsafe characters", () => {
    expect(extractInvitationToken("short-token")).toBeNull();
    expect(extractInvitationToken(`${INVITE_SEGMENT}!`)).toBeNull();
  });
});

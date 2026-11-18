import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createOAuthState,
  verifyOAuthState,
} from "@/lib/integrations/google/oauth-state";
import {
  decryptToken,
  encryptToken,
  safeEqual,
  TokenCryptoError,
} from "@/lib/integrations/google/token-crypto";

const USER_ID = "3f2b6c1e-8a4d-4f6b-9c2e-1d5a7b9c0e3f";
const DOMAIN = "calendar" as const;

describe("encryptToken / decryptToken", () => {
  const key = randomBytes(32);

  it("round-trips a refresh token", () => {
    const payload = encryptToken("1//refresh-token-value", key, DOMAIN);

    expect(payload.startsWith("v1:")).toBe(true);
    expect(payload).not.toContain("refresh-token-value");
    expect(decryptToken(payload, key, DOMAIN)).toBe("1//refresh-token-value");
  });

  it("uses a fresh IV so the same plaintext encrypts differently", () => {
    const first = encryptToken("same", key, DOMAIN);
    const second = encryptToken("same", key, DOMAIN);

    expect(first).not.toBe(second);
    expect(decryptToken(first, key, DOMAIN)).toBe("same");
    expect(decryptToken(second, key, DOMAIN)).toBe("same");
  });

  it("rejects a ciphertext encrypted with another key", () => {
    const payload = encryptToken("secret", key, DOMAIN);

    expect(() => decryptToken(payload, randomBytes(32), DOMAIN)).toThrow(
      TokenCryptoError,
    );
  });

  it("rejects a tampered auth tag", () => {
    const payload = encryptToken("secret", key, DOMAIN);
    const [version, iv, tag, ciphertext] = payload.split(":");
    const tampered = [version, iv, flipBase64(tag ?? ""), ciphertext].join(":");

    expect(() => decryptToken(tampered, key, DOMAIN)).toThrow(TokenCryptoError);
  });

  it("rejects a tampered ciphertext", () => {
    const payload = encryptToken("secret", key, DOMAIN);
    const [version, iv, tag, ciphertext] = payload.split(":");
    const tampered = [version, iv, tag, flipBase64(ciphertext ?? "")].join(":");

    expect(() => decryptToken(tampered, key, DOMAIN)).toThrow(TokenCryptoError);
  });

  it("rejects an unknown envelope version", () => {
    expect(() => decryptToken("v2:a:b:c", key, DOMAIN)).toThrow(
      TokenCryptoError,
    );
  });

  it("rejects a payload with the wrong number of parts", () => {
    expect(() => decryptToken("v1:only-two", key, DOMAIN)).toThrow(
      TokenCryptoError,
    );
  });

  it("refuses a key that is not 32 bytes", () => {
    expect(() => encryptToken("x", randomBytes(16), DOMAIN)).toThrow(
      TokenCryptoError,
    );
    expect(() => decryptToken("v1:a:b:c", randomBytes(16), DOMAIN)).toThrow(
      TokenCryptoError,
    );
  });
});

describe("domain separation", () => {
  const key = randomBytes(32);

  it("rejects a Drive ciphertext decrypted as Calendar", () => {
    const payload = encryptToken("drive-secret", key, "drive");

    expect(() => decryptToken(payload, key, "calendar")).toThrow(
      TokenCryptoError,
    );
  });

  it("round-trips within the drive domain", () => {
    const payload = encryptToken("drive-secret", key, "drive");

    expect(decryptToken(payload, key, "drive")).toBe("drive-secret");
  });

  it("still decrypts rows written before separation (legacy AAD)", () => {
    // Rows written before domain separation used the calendar AAD, including
    // Drive rows. Separated drive rows must remain readable via the fallback.
    const legacy = encryptToken("old-secret", key, "calendar");

    expect(decryptToken(legacy, key, "drive")).toBe("old-secret");
  });
});

describe("safeEqual", () => {
  it("compares equal strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
  });

  it("rejects different strings and different lengths", () => {
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("createOAuthState / verifyOAuthState", () => {
  it("binds a fresh random state to the user", () => {
    const { state, cookieValue } = createOAuthState(USER_ID);

    expect(state.length).toBeGreaterThanOrEqual(32);
    expect(cookieValue).toBe(`${USER_ID}:${state}`);
    expect(verifyOAuthState(cookieValue, state, USER_ID)).toBe(true);
  });

  it("produces a different state on every call", () => {
    const first = createOAuthState(USER_ID);
    const second = createOAuthState(USER_ID);

    expect(first.state).not.toBe(second.state);
  });

  it("rejects a callback for another user", () => {
    const { state, cookieValue } = createOAuthState(USER_ID);

    expect(
      verifyOAuthState(
        cookieValue,
        state,
        "11111111-2222-3333-4444-555555555555",
      ),
    ).toBe(false);
  });

  it("rejects a state that does not match the cookie", () => {
    const { cookieValue } = createOAuthState(USER_ID);

    expect(verifyOAuthState(cookieValue, "a".repeat(43), USER_ID)).toBe(false);
  });

  it("rejects a missing cookie or missing parameter", () => {
    const { state, cookieValue } = createOAuthState(USER_ID);

    expect(verifyOAuthState(undefined, state, USER_ID)).toBe(false);
    expect(verifyOAuthState(cookieValue, null, USER_ID)).toBe(false);
  });

  it("rejects a malformed cookie", () => {
    expect(verifyOAuthState("nocolon", "abc", USER_ID)).toBe(false);
    expect(
      verifyOAuthState(`:${"a".repeat(43)}`, "a".repeat(43), USER_ID),
    ).toBe(false);
  });

  it("rejects a cookie whose state is too short to be ours", () => {
    expect(verifyOAuthState(`${USER_ID}:short`, "short", USER_ID)).toBe(false);
  });
});

/** Flips one base64 character so the GCM tag or ciphertext no longer matches. */
function flipBase64(value: string): string {
  const chars = [...value];

  if (chars.length === 0) {
    return value;
  }

  chars[0] = chars[0] === "A" ? "B" : "A";

  return chars.join("");
}

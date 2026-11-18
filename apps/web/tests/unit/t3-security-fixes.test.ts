import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  exportRawPublicKey,
  generateEcdhKeyPair,
} from "@/lib/crypto/e2ee-ratchet";
import { isValidP256PublicKey } from "@/lib/db/dm-devices";
import { buildDriveAuthorizationUrl } from "@/lib/integrations/google/drive-oauth";

const backupMocks = vi.hoisted(() => ({
  userId: "user-1",
  wrapped: "",
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: backupMocks.userId } },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { wrapped_private_key: backupMocks.wrapped },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

import { restorePrivateKey } from "@/lib/crypto/key-backup";

describe("Google Drive OAuth scope isolation", () => {
  it("sets include_granted_scopes=false so calendar scopes are not merged", () => {
    const authUrl = buildDriveAuthorizationUrl({
      config: {
        clientId: "drive-client-id",
        clientSecret: "drive-client-secret",
        redirectUri: "https://app.test/api/integrations/google-drive/callback",
        encryptionKey: Buffer.alloc(32, 1),
      },
      state: "opaque-state",
    });
    const parsed = new URL(authUrl);

    expect(parsed.searchParams.get("include_granted_scopes")).toBe("false");
    expect(parsed.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/drive.file",
    );
  });
});

describe("isValidP256PublicKey", () => {
  it("accepts valid raw and public JWK P-256 keys", async () => {
    const pair = await generateEcdhKeyPair();
    const rawB64 = await exportRawPublicKey(pair.publicKey);
    const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);

    expect(await isValidP256PublicKey(rawB64)).toBe(true);
    expect(await isValidP256PublicKey(JSON.stringify(jwk))).toBe(true);
  });

  it("rejects malformed keys, off-curve bytes, and private JWKs", async () => {
    const pair = await generateEcdhKeyPair();
    const privJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const zeroPoint = Buffer.concat([
      Buffer.from([0x04]),
      Buffer.alloc(64, 0),
    ]).toString("base64");

    expect(await isValidP256PublicKey("")).toBe(false);
    expect(await isValidP256PublicKey("not-base64!")).toBe(false);
    expect(await isValidP256PublicKey(zeroPoint)).toBe(false);
    expect(await isValidP256PublicKey(JSON.stringify(privJwk))).toBe(false);
  });
});

describe("restorePrivateKey PBKDF2 iteration bounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    "v2:10:c2FsdA==:aXY=:Y2lwaGVy",
    "v2:5000000:c2FsdA==:aXY=:Y2lwaGVy",
    "v2:600000.5:c2FsdA==:aXY=:Y2lwaGVy",
  ])(
    "rejects out-of-range iterations (%s) before calling subtle.deriveKey",
    async (wrapped) => {
      backupMocks.wrapped = wrapped;
      const deriveSpy = vi.spyOn(crypto.subtle, "deriveKey");

      await expect(
        restorePrivateKey("a-very-strong-passphrase"),
      ).rejects.toThrow("Invalid backup format.");
      expect(deriveSpy).not.toHaveBeenCalled();
      deriveSpy.mockRestore();
    },
  );
});

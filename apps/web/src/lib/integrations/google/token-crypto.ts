import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * AES-256-GCM envelope for OAuth credentials.
 *
 * Stored format: `v1:<iv base64>:<auth tag base64>:<ciphertext base64>`.
 * The version prefix allows a future key rotation to recognise old rows instead
 * of failing to decrypt them.
 */
const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/** Additional authenticated data: binds a ciphertext to this purpose. */
const AAD = Buffer.from("starstask:google-calendar-credentials:v1", "utf8");

export class TokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenCryptoError";
  }
}

export function encryptToken(plaintext: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new TokenCryptoError("Encryption key must be 32 bytes");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(AAD);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Reverses {@link encryptToken}.
 *
 * @throws {TokenCryptoError} when the payload is malformed, the version is
 * unknown, or the authentication tag does not match — a tampered ciphertext is
 * rejected rather than decrypted into garbage.
 */
export function decryptToken(payload: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new TokenCryptoError("Encryption key must be 32 bytes");
  }

  const parts = payload.split(":");

  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new TokenCryptoError("Unsupported credential format");
  }

  const [, ivPart, tagPart, ciphertextPart] = parts;

  if (!ivPart || !tagPart || !ciphertextPart) {
    throw new TokenCryptoError("Incomplete credential payload");
  }

  const iv = Buffer.from(ivPart, "base64");
  const tag = Buffer.from(tagPart, "base64");
  const ciphertext = Buffer.from(ciphertextPart, "base64");

  if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
    throw new TokenCryptoError("Invalid credential envelope");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new TokenCryptoError("Could not decrypt credentials");
  }
}

/** Constant-time string comparison for short secrets such as OAuth state. */
export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

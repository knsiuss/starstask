import "server-only";

import { getSiteUrl } from "@/lib/env/public";

/**
 * Minimum scope for Drive submission. `drive.file` only exposes files the
 * user picks through the Picker — not the whole Drive. Full read/write
 * scopes are deliberately not requested.
 */
export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export const GOOGLE_DRIVE_SCOPES = [GOOGLE_DRIVE_SCOPE] as const;

export const GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

export type GoogleDriveConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: Buffer;
};

export function parseEncryptionKey(value: string | undefined): Buffer | null {
  if (!value) return null;
  const trimmed = value.trim();
  const decoded = Buffer.from(trimmed, "base64");
  if (decoded.length !== 32) return null;
  return decoded.toString("base64").replace(/=+$/, "") ===
    trimmed.replace(/=+$/, "")
    ? decoded
    : null;
}

export function getGoogleDriveRedirectUri(): string {
  return (
    process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim() ||
    `${getSiteUrl().replace(/\/$/, "")}/api/integrations/google-drive/callback`
  );
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
    process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
    parseEncryptionKey(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY),
  );
}

export function getGoogleDriveConfig(): GoogleDriveConfig {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
  const encryptionKey = parseEncryptionKey(
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
  );

  if (!clientId || !clientSecret) {
    throw new Error("Google Drive OAuth client is not configured");
  }
  if (!encryptionKey) {
    throw new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: getGoogleDriveRedirectUri(),
    encryptionKey,
  };
}

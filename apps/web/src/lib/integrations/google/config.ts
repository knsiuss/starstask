import "server-only";

import { getSiteUrl } from "@/lib/env/public";

/**
 * Minimum scope for the optional Calendar integration.
 *
 * `calendar.events` allows creating, updating, and deleting events on the
 * user's calendars — everything StarsTask needs — while `calendar.readonly` and
 * `calendar` (full account access) are deliberately not requested. The app
 * never reads the user's other events except to find the one it created itself
 * through a private extended property.
 */
export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

/** Scopes sent in the authorization request. */
export const GOOGLE_CALENDAR_SCOPES = [GOOGLE_CALENDAR_SCOPE] as const;

export const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";

export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export const GOOGLE_CALENDAR_API_BASE =
  "https://www.googleapis.com/calendar/v3";

/** Private extended property that marks an event as StarsTask-managed. */
export const STARSTASK_EVENT_PROPERTY = "starstaskSessionId";

export type GoogleCalendarConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: Buffer;
};

/**
 * Parses the AES key. Only base64 of exactly 32 bytes is accepted; a short or
 * malformed key fails loudly at request time instead of silently weakening the
 * encryption.
 */
export function parseEncryptionKey(value: string | undefined): Buffer | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const decoded = Buffer.from(trimmed, "base64");

  if (decoded.length !== 32) {
    return null;
  }

  // Reject strings that decode to the right length only because Buffer is
  // lenient about invalid characters.
  return decoded.toString("base64").replace(/=+$/, "") ===
    trimmed.replace(/=+$/, "")
    ? decoded
    : null;
}

export function getGoogleCalendarRedirectUri(): string {
  return (
    process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ||
    `${getSiteUrl().replace(/\/$/, "")}/api/integrations/google-calendar/callback`
  );
}

/** True when every value the OAuth flow needs is present. */
export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CALENDAR_CLIENT_ID &&
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET &&
    parseEncryptionKey(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY),
  );
}

/**
 * Reads the Calendar configuration.
 *
 * @throws {Error} when a required value is missing or the key is malformed.
 * Callers should check {@link isGoogleCalendarConfigured} first and show a
 * "not configured" state instead of surfacing this as a crash.
 */
export function getGoogleCalendarConfig(): GoogleCalendarConfig {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const encryptionKey = parseEncryptionKey(
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
  );

  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar OAuth client is not configured");
  }

  if (!encryptionKey) {
    throw new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: getGoogleCalendarRedirectUri(),
    encryptionKey,
  };
}

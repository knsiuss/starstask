import { randomBytes } from "node:crypto";

/**
 * OAuth state handling for the optional Calendar connection.
 *
 * The state value is random and single-use. It is bound to the signed-in user
 * inside an httpOnly cookie, so a callback URL captured from another browser
 * cannot attach a stranger's Google account to the victim's StarsTask account.
 */
export const OAUTH_STATE_COOKIE = "gcal_oauth_state";

/** The user has ten minutes to finish the consent screen. */
export const OAUTH_STATE_MAX_AGE_SECONDS = 600;

const STATE_BYTES = 32;

export type OAuthStatePair = {
  /** Goes into the `state` query parameter and comes back in the callback. */
  state: string;
  /** Stored in the httpOnly cookie; binds the state to one user. */
  cookieValue: string;
};

export function createOAuthState(userId: string): OAuthStatePair {
  const state = randomBytes(STATE_BYTES).toString("base64url");

  return { state, cookieValue: `${userId}:${state}` };
}

/**
 * Checks a callback against the cookie and the current session.
 *
 * Every failure mode — missing cookie, missing parameter, a different user, a
 * different state — returns `false`; the caller then redirects with a generic
 * error instead of hinting at which check failed.
 */
export function verifyOAuthState(
  cookieValue: string | undefined,
  state: string | null,
  userId: string,
): boolean {
  if (!cookieValue || !state) {
    return false;
  }

  const separator = cookieValue.indexOf(":");

  if (separator <= 0) {
    return false;
  }

  const boundUserId = cookieValue.slice(0, separator);
  const boundState = cookieValue.slice(separator + 1);

  if (boundState.length < 32 || boundUserId.length === 0) {
    return false;
  }

  return boundUserId === userId && boundState === state;
}

import "server-only";

import {
  GOOGLE_AUTHORIZATION_ENDPOINT,
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_REVOKE_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  type GoogleCalendarConfig,
} from "@/lib/integrations/google/config";

/** Network calls time out well before the route's own budget. */
const REQUEST_TIMEOUT_MS = 10_000;

export type GoogleTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scope: string;
};

export type GoogleOAuthErrorCategory =
  "invalid_grant" | "invalid_request" | "transient" | "invalid_response";

export class GoogleOAuthError extends Error {
  constructor(
    readonly category: GoogleOAuthErrorCategory,
    message: string,
  ) {
    super(message);
    this.name = "GoogleOAuthError";
  }
}

/**
 * Builds the consent URL.
 *
 * `access_type=offline` is requested because event creation happens from the
 * server while the user is away (a session update, a retry job), which needs a
 * refresh token. `include_granted_scopes=true` keeps any scope the account
 * already granted, and `prompt=consent` makes Google return a refresh token on
 * a reconnect instead of silently reusing one StarsTask no longer holds.
 */
export function buildGoogleAuthorizationUrl(options: {
  config: GoogleCalendarConfig;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: options.config.clientId,
    redirect_uri: options.config.redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: options.state,
  });

  return `${GOOGLE_AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

type TokenEndpointBody = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  error?: unknown;
};

async function postTokenEndpoint(
  body: URLSearchParams,
): Promise<GoogleTokenSet> {
  let response: Response;

  try {
    response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new GoogleOAuthError(
      "transient",
      "Google token endpoint unreachable",
    );
  }

  const payload = (await response
    .json()
    .catch(() => null)) as TokenEndpointBody | null;

  if (!response.ok) {
    const code = typeof payload?.error === "string" ? payload.error : "unknown";

    if (code === "invalid_grant") {
      throw new GoogleOAuthError("invalid_grant", "Authorization was revoked");
    }

    if (response.status >= 500 || response.status === 429) {
      throw new GoogleOAuthError("transient", "Google token endpoint failed");
    }

    throw new GoogleOAuthError("invalid_request", "Token request rejected");
  }

  const accessToken = payload?.access_token;
  const expiresIn = payload?.expires_in;

  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new GoogleOAuthError("invalid_response", "No access token returned");
  }

  const lifetimeSeconds =
    typeof expiresIn === "number" && Number.isFinite(expiresIn)
      ? expiresIn
      : 3_600;

  return {
    accessToken,
    refreshToken:
      typeof payload?.refresh_token === "string" &&
      payload.refresh_token.length > 0
        ? payload.refresh_token
        : null,
    expiresAt: new Date(Date.now() + lifetimeSeconds * 1_000).toISOString(),
    scope:
      typeof payload?.scope === "string"
        ? payload.scope
        : GOOGLE_CALENDAR_SCOPE,
  };
}

/** Exchanges the authorization code for tokens. The code is single use. */
export async function exchangeAuthorizationCode(
  config: GoogleCalendarConfig,
  code: string,
): Promise<GoogleTokenSet> {
  return postTokenEndpoint(
    new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  );
}

/**
 * Refreshes an access token. Google does not return a new refresh token here,
 * so the caller keeps the stored one.
 */
export async function refreshAccessToken(
  config: GoogleCalendarConfig,
  refreshToken: string,
): Promise<GoogleTokenSet> {
  return postTokenEndpoint(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  );
}

/**
 * Best-effort revocation. A failure is not fatal: the local connection is
 * deleted either way, and the user can also revoke from their Google account.
 */
export async function revokeGoogleToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(GOOGLE_REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  }
}

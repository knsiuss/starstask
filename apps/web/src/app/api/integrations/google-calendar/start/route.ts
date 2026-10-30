import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
  getGoogleCalendarConfig,
  isGoogleCalendarConfigured,
} from "@/lib/integrations/google/config";
import { buildGoogleAuthorizationUrl } from "@/lib/integrations/google/oauth";
import {
  createOAuthState,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
} from "@/lib/integrations/google/oauth-state";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const CALENDAR_SETTINGS_PATH = "/settings/calendar";

/**
 * Starts the optional Calendar connection.
 *
 * This is a separate consent from Google Sign-In: Supabase Auth never sees the
 * Calendar scope, and the user reaches this route only by choosing to connect.
 */
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const settingsUrl = new URL(CALENDAR_SETTINGS_PATH, origin);

  if (!isGoogleCalendarConfigured()) {
    settingsUrl.searchParams.set("error", "not_configured");

    return NextResponse.redirect(settingsUrl, { status: 303 });
  }

  const session = await getSessionUser();

  if (!session) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("next", CALENDAR_SETTINGS_PATH);

    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  try {
    await enforceRateLimit({
      action: "calendar:connect_start",
      identifier: session.user.id || getClientIdentifier(request),
      limit: 20,
      windowSeconds: 3600,
    });
  } catch {
    settingsUrl.searchParams.set("error", "rate_limited");

    return NextResponse.redirect(settingsUrl, { status: 303 });
  }

  const config = getGoogleCalendarConfig();
  const { state, cookieValue } = createOAuthState(session.user.id);

  const response = NextResponse.redirect(
    buildGoogleAuthorizationUrl({ config, state }),
    { status: 303 },
  );

  // httpOnly keeps the state out of reach of scripts; SameSite=Lax still lets
  // Google's top-level redirect carry it back to the callback.
  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: cookieValue,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/google-calendar",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  response.headers.set("Cache-Control", "no-store");

  return response;
}

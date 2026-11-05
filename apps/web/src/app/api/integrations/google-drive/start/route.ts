import { NextResponse, type NextRequest } from "next/server";

import { apiError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import {
  getGoogleDriveConfig,
  isGoogleDriveConfigured,
} from "@/lib/integrations/google/drive-config";
import { buildDriveAuthorizationUrl } from "@/lib/integrations/google/drive-oauth";
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

const DRIVE_SETTINGS_PATH = "/settings/drive";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const settingsUrl = new URL(DRIVE_SETTINGS_PATH, origin);

  if (!isGoogleDriveConfigured()) {
    settingsUrl.searchParams.set("error", "not_configured");
    return NextResponse.redirect(settingsUrl, { status: 303 });
  }

  const session = await getSessionUser();
  if (!session) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("next", DRIVE_SETTINGS_PATH);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  try {
    await enforceRateLimit({
      action: "drive:connect_start",
      identifier: session.user.id || getClientIdentifier(request),
      limit: 20,
      windowSeconds: 3600,
    });
  } catch {
    settingsUrl.searchParams.set("error", "rate_limited");
    return NextResponse.redirect(settingsUrl, { status: 303 });
  }

  const config = getGoogleDriveConfig();
  const { state, cookieValue } = createOAuthState(session.user.id);

  const response = NextResponse.redirect(
    buildDriveAuthorizationUrl({ config, state }),
    { status: 303 },
  );

  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: cookieValue,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/google-drive",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST() {
  return apiError(405, "method_not_allowed", "Use GET to connect Drive.");
}

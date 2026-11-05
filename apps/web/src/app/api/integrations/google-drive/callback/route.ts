import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { saveDriveConnection } from "@/lib/db/google-drive-connections";
import {
  getGoogleDriveConfig,
  isGoogleDriveConfigured,
} from "@/lib/integrations/google/drive-config";
import { toCalendarConfig } from "@/lib/integrations/google/drive-oauth";
import {
  exchangeAuthorizationCode,
  GoogleOAuthError,
} from "@/lib/integrations/google/oauth";
import {
  OAUTH_STATE_COOKIE,
  verifyOAuthState,
} from "@/lib/integrations/google/oauth-state";

export const dynamic = "force-dynamic";

const DRIVE_SETTINGS_PATH = "/settings/drive";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const redirect = (params: Record<string, string>) => {
    const url = new URL(DRIVE_SETTINGS_PATH, origin);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const response = NextResponse.redirect(url, {
      status: 303,
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set({
      name: OAUTH_STATE_COOKIE,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/integrations/google-drive",
      maxAge: 0,
    });
    return response;
  };

  if (!isGoogleDriveConfigured()) {
    return redirect({ error: "not_configured" });
  }

  const session = await getSessionUser();
  if (!session) {
    return redirect({ error: "session_expired" });
  }

  const state = requestUrl.searchParams.get("state");
  if (
    !verifyOAuthState(
      request.cookies.get(OAUTH_STATE_COOKIE)?.value,
      state,
      session.user.id,
    )
  ) {
    console.error("[drive] oauth state rejected");
    return redirect({ error: "invalid_state" });
  }

  const providerError = requestUrl.searchParams.get("error");
  if (providerError) {
    return redirect({
      error:
        providerError === "access_denied" ? "cancelled" : "callback_failed",
    });
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) return redirect({ error: "callback_failed" });

  try {
    const config = getGoogleDriveConfig();
    const tokens = await exchangeAuthorizationCode(
      toCalendarConfig(config),
      code,
    );

    // Best-effort email lookup for the settings display.
    let driveEmail: string | null = null;
    try {
      const response = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
          cache: "no-store",
        },
      );
      if (response.ok) {
        const info = (await response.json()) as { email?: string };
        driveEmail = info.email ?? null;
      }
    } catch {
      driveEmail = null;
    }

    await saveDriveConnection(session.user.id, tokens, driveEmail);
    return redirect({ connected: "1" });
  } catch (error) {
    if (error instanceof GoogleOAuthError) {
      console.error("[drive] code exchange failed", {
        category: error.category,
      });
      return redirect({
        error: error.category === "transient" ? "transient" : "callback_failed",
      });
    }
    console.error("[drive] connection could not be stored");
    return redirect({ error: "storage_failed" });
  }
}

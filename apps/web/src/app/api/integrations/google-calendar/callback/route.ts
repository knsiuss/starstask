import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
  getGoogleCalendarConfig,
  isGoogleCalendarConfigured,
} from "@/lib/integrations/google/config";
import {
  exchangeAuthorizationCode,
  GoogleOAuthError,
} from "@/lib/integrations/google/oauth";
import {
  OAUTH_STATE_COOKIE,
  verifyOAuthState,
} from "@/lib/integrations/google/oauth-state";
import { saveCalendarConnection } from "@/features/integrations/google-calendar-service";

export const dynamic = "force-dynamic";

const CALENDAR_SETTINGS_PATH = "/settings/calendar";

/**
 * Completes the Calendar consent flow.
 *
 * The callback never touches the Supabase session: it only stores a separate
 * Google grant, so connecting or failing to connect a calendar cannot sign the
 * user out. State is validated against an httpOnly cookie bound to the current
 * user before the authorization code is used.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const redirect = (params: Record<string, string>) => {
    const url = new URL(CALENDAR_SETTINGS_PATH, origin);

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
      path: "/api/integrations/google-calendar",
      maxAge: 0,
    });

    return response;
  };

  if (!isGoogleCalendarConfigured()) {
    return redirect({ error: "not_configured" });
  }

  const session = await getSessionUser();

  if (!session) {
    // The sign-in session expired while the consent screen was open. Nothing is
    // stored; the user can start again after signing in.
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
    console.error("[calendar] oauth state rejected");
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

  if (!code) {
    return redirect({ error: "callback_failed" });
  }

  try {
    const tokens = await exchangeAuthorizationCode(
      getGoogleCalendarConfig(),
      code,
    );

    await saveCalendarConnection(session.user.id, tokens);

    return redirect({ connected: "1" });
  } catch (error) {
    if (error instanceof GoogleOAuthError) {
      console.error("[calendar] code exchange failed", {
        category: error.category,
      });

      return redirect({
        error: error.category === "transient" ? "transient" : "callback_failed",
      });
    }

    console.error("[calendar] connection could not be stored");

    return redirect({ error: "storage_failed" });
  }
}

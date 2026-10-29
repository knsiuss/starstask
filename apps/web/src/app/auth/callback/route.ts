import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured } from "@/lib/env/public";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";
import { safeRedirectPath } from "@/lib/security/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Completes the Supabase OAuth (PKCE) flow.
 *
 * The `next` parameter is always reduced to an allowlisted internal path. The
 * authorization code is exchanged for a session using cookies; tokens never
 * appear in a URL or log line.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const nextPath = safeRedirectPath(
    requestUrl.searchParams.get("next"),
    "/assignments",
  );
  const redirectToLogin = (reason: string) =>
    NextResponse.redirect(
      new URL(
        `/login?error=${reason}&next=${encodeURIComponent(nextPath)}`,
        requestUrl.origin,
      ),
      {
        status: 303,
        headers: { "Cache-Control": "no-store" },
      },
    );

  if (!isSupabaseConfigured()) {
    return redirectToLogin("not_configured");
  }

  try {
    await enforceRateLimit({
      action: "auth:callback",
      identifier: getClientIdentifier(request),
      limit: 30,
      windowSeconds: 300,
    });
  } catch {
    return redirectToLogin("rate_limited");
  }

  const providerError = requestUrl.searchParams.get("error");
  const code = requestUrl.searchParams.get("code");

  if (providerError) {
    return redirectToLogin(
      providerError === "access_denied" ? "oauth_cancelled" : "callback_failed",
    );
  }

  if (!code) {
    return redirectToLogin("callback_failed");
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth] code exchange failed", { code: exchangeError.code });
    return redirectToLogin("callback_failed");
  }

  // The profile is provisioned by a database trigger. If it is missing the
  // trigger is not installed; log a non-sensitive marker instead of failing the
  // whole sign-in.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      console.error("[auth] profile missing after sign-in");
    }
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin), {
    status: 303,
    headers: { "Cache-Control": "no-store" },
  });
}

export const dynamic = "force-dynamic";

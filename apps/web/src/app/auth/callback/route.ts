import { NextResponse, type NextRequest } from "next/server";

import { resolveSignedInHomePath } from "@/lib/auth/developer";
import { isSupabaseConfigured } from "@/lib/env/public";
import { recordAuthActivity } from "@/lib/observability/events";
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
    await recordAuthActivity({
      eventType: "sign_in_failed",
      userId: null,
      reason: "rate_limited",
    });
    return redirectToLogin("rate_limited");
  }

  const providerError = requestUrl.searchParams.get("error");
  const code = requestUrl.searchParams.get("code");

  if (providerError) {
    await recordAuthActivity({
      eventType: "sign_in_failed",
      userId: null,
      reason:
        providerError === "access_denied"
          ? "oauth_cancelled"
          : "provider_error",
    });
    return redirectToLogin(
      providerError === "access_denied" ? "oauth_cancelled" : "callback_failed",
    );
  }

  if (!code) {
    await recordAuthActivity({
      eventType: "sign_in_failed",
      userId: null,
      reason: "missing_code",
    });
    return redirectToLogin("callback_failed");
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth] code exchange failed", { code: exchangeError.code });
    await recordAuthActivity({
      eventType: "sign_in_failed",
      userId: null,
      reason: "exchange_failed",
    });
    return redirectToLogin("callback_failed");
  }

  // The profile is provisioned by a database trigger. If it is missing the
  // trigger is not installed; log a non-sensitive marker instead of failing the
  // whole sign-in.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A `next` the caller supplied explicitly decides the destination. When the
  // sign-in had no usable `next`, each account kind lands in its own home area
  // (console for developers, workspace for members).
  const destination =
    requestUrl.searchParams.get("next") !== null
      ? nextPath
      : resolveSignedInHomePath(user?.email);

  if (user) {
    const provider =
      typeof user.app_metadata.provider === "string"
        ? user.app_metadata.provider
        : null;

    await recordAuthActivity({
      eventType: "sign_in_succeeded",
      userId: user.id,
      provider,
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, onboarded_at")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      console.error("[auth] profile missing after sign-in");
    } else if (!profile.onboarded_at) {
      // The session is already valid; the only thing left is the profile form.
      // The destination is preserved so the user lands where they aimed after
      // onboarding, and `/onboarding` is never a login target (no loop).
      const onboardingPath = `/onboarding?next=${encodeURIComponent(destination)}`;

      return NextResponse.redirect(new URL(onboardingPath, requestUrl.origin), {
        status: 303,
        headers: { "Cache-Control": "no-store" },
      });
    }
  }

  return NextResponse.redirect(new URL(destination, requestUrl.origin), {
    status: 303,
    headers: { "Cache-Control": "no-store" },
  });
}

export const dynamic = "force-dynamic";

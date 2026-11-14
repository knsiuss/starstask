import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { isSupabaseConfigured, getSupabaseConfig } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  onboarded_at: string | null;
};

export type SessionUser = {
  user: User;
  profile: SessionProfile | null;
};

/**
 * Resolves the signed-in user from a Supabase access token supplied by the
 * native Android client. Additive to the cookie-based path: web routes that
 * want native clients call this instead, existing cookie callers are not
 * changed. The token is validated with `auth.getUser()`; unverified metadata
 * is never treated as identity.
 */
export async function getSessionUserFromBearer(
  accessToken: string,
): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const { url, key } = getSupabaseConfig();
  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[session] profile lookup failed", {
      code: profileError.code,
    });
  }

  return { user, profile };
}

/**
 * Extracts `Authorization: Bearer <token>` from a header value, or null.
 * Bearer is preferred over cookies whenever both are present.
 */
export function readBearerTokenFromHeaderValue(
  header: string | null,
): string | null {
  if (!header) {
    return null;
  }

  const [scheme, ...rest] = header.trim().split(/\s+/);

  if (!scheme || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  const token = rest.join(" ").trim();

  return token.length > 0 ? token : null;
}

/** Extracts `Authorization: Bearer <token>` from a Request, or null. */
export function readBearerToken(request: Request): string | null {
  return readBearerTokenFromHeaderValue(request.headers.get("authorization"));
}

/**
 * Resolves the signed-in user for the current request. Bearer wins when both
 * header and cookie are present; otherwise this behaves exactly as before.
 *
 * Uses `auth.getUser()`, which verifies the token with Supabase Auth. Client
 * supplied metadata and unverified cookies are never treated as identity.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { headers } = await import("next/headers");
  const bearer = readBearerTokenFromHeaderValue(
    (await headers()).get("authorization"),
  );

  if (bearer) {
    return getSessionUserFromBearer(bearer);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // `university` has no SELECT grant for `authenticated` (private, RPC-only),
  // so it must not be selected here: one ungranted column rejects the whole
  // query and `profile` would silently be null.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[session] profile lookup failed", {
      code: profileError.code,
    });
  }

  return { user, profile };
});

import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

export type SessionUser = {
  user: User;
  profile: SessionProfile | null;
};

/**
 * Resolves the signed-in user for the current request.
 *
 * Uses `auth.getUser()`, which verifies the token with Supabase Auth. Client
 * supplied metadata and unverified cookies are never treated as identity.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
});

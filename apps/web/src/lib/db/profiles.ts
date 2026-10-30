import "server-only";

import {
  classJoinResultSchema,
  myProfileSchema,
  type ClassJoinResult,
  type MyProfile,
  type ProfileBioInput,
  type ProfileOnboardingInput,
} from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The caller's own profile, including the private full name and NIM.
 *
 * These columns have no client grant, so the only way to read them is this
 * SECURITY DEFINER call, which derives the owner from `auth.uid()`.
 */
export async function getMyProfile(): Promise<MyProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_my_profile", {});

  if (error) {
    throw new DataAccessError("Could not load your profile", error.code);
  }

  if (data === null) {
    return null;
  }

  const parsed = myProfileSchema.safeParse(data);

  if (!parsed.success) {
    throw new DataAccessError("Your profile could not be read", "parse_error");
  }

  return parsed.data;
}

/**
 * Persists the onboarding form and marks the profile complete.
 *
 * The class name is stored as typed; matching happens separately so a save can
 * succeed even when no class matches.
 */
export async function updateMyProfile(
  input: ProfileOnboardingInput,
): Promise<MyProfile> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_my_profile", {
    p_full_name: input.fullName,
    p_nickname: input.nickname,
    p_nim: input.nim,
    p_university: input.university,
    p_declared_class: input.className ?? null,
  });

  if (error || data === null) {
    throw new DataAccessError("Could not save your profile", error?.code);
  }

  const parsed = myProfileSchema.safeParse(data);

  if (!parsed.success) {
    throw new DataAccessError("Your profile could not be saved", "parse_error");
  }

  return parsed.data;
}

/** Saves or clears the short profile bio. Identity comes from the session. */
export async function updateMyBio(
  input: ProfileBioInput,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_my_bio", {
    p_bio: input.bio ?? "",
  });

  if (error) {
    throw new DataAccessError("Could not save your bio", error.code);
  }

  return data ?? null;
}

/** Points the profile at a freshly stored avatar. */
export async function setMyAvatarUrl(avatarUrl: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_my_avatar_url", {
    p_avatar_url: avatarUrl,
  });

  if (error) {
    throw new DataAccessError("Could not save your photo", error.code);
  }
}

/**
 * Attempts to join one class by the name the student typed.
 *
 * All matching and policy decisions happen inside the database function; this
 * wrapper only normalizes the RPC result into a typed, discriminated union.
 */
export async function joinClassByName(
  rawClassName: string,
): Promise<ClassJoinResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("join_class_by_name", {
    p_class_name: rawClassName,
  });

  if (error || data === null) {
    throw new DataAccessError("Could not check the class name", error?.code);
  }

  const parsed = classJoinResultSchema.safeParse(data);

  if (!parsed.success) {
    throw new DataAccessError("The class check failed", "parse_error");
  }

  return parsed.data;
}

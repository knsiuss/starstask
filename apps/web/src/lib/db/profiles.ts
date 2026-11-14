import "server-only";

import { cache } from "react";

import {
  classJoinResultSchema,
  myProfileSchema,
  type ClassJoinResult,
  type MyProfile,
  type ProfileBioInput,
  type ProfileOnboardingInput,
  type StudentCreateClassInput,
} from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The caller's own profile, including the private full name and NIM.
 *
 * These columns have no client grant, so the only way to read them is this
 * SECURITY DEFINER call, which derives the owner from `auth.uid()`.
 */
export const getMyProfile = cache(async (): Promise<MyProfile | null> => {
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
});

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
    p_nim: input.nim ?? null,
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

/**
 * Creates a self-organized class for the signed-in student.
 *
 * The RPC inserts the class, adds the creator as its first member
 * (`joined_via = 'student_created'`, so the auto-ketua trigger names them
 * ketua), and applies the 3-active-class abuse cap. It raises P0001 when the
 * cap is reached; the route maps that to a 409.
 */
export async function createClassAsStudent(
  input: StudentCreateClassInput,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_class_as_student", {
    p_proposed_slug: input.slug,
    p_proposed_name: input.name,
    p_course_name: input.courseName,
    p_semester: input.semester,
    p_academic_year: input.academicYear,
    p_description: input.description,
    p_join_policy: input.joinPolicy,
  });

  if (error || data === null) {
    throw new DataAccessError("Could not create your class", error?.code);
  }

  return data as string;
}

/**
 * Creates the class when onboarding hits a no-match.
 *
 * The slug fallback is the normalized class name when the typed value has no
 * usable slug shape, so the RPC never rejects a legal typed name. Description
 * is synthesized from the class name because the onboarding form has no
 * description field; the student can edit it later.
 */
export async function joinOrCreateClass(
  className: string,
): Promise<ClassJoinResult> {
  const joined = await joinClassByName(className);

  if (joined.status !== "no_match") {
    return joined;
  }

  const year = new Date().getFullYear();
  const created = await createClassAsStudent({
    slug: slugifyClassName(className),
    name: className,
    courseName: className,
    semester: "Ganjil",
    academicYear: `${year}/${year + 1}`,
    description: `Kelas yang dibuat saat onboarding oleh mahasiswa untuk ${className}.`,
    joinPolicy: "open",
  });

  return {
    status: "joined",
    classId: created,
    slug: slugifyClassName(className),
    name: className,
  };
}

/** Mirrors the slug rule JOIN uses server-side: lowercase letters/digits/hyphen. */
function slugifyClassName(className: string): string {
  const key = className
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  if (key.length >= 3) {
    return key;
  }

  const digits =
    className
      .match(/[a-zA-Z0-9]+/g)
      ?.join("")
      .toLowerCase() ?? "";
  const fallback = `${digits}${"0".repeat(Math.max(0, 3 - digits.length))}`;
  return fallback.length >= 3 ? fallback.slice(0, 80) : "ko-kelas";
}

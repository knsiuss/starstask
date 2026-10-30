import "server-only";

import type {
  ClassJoinResult,
  MyProfile,
  ProfileOnboardingInput,
} from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import { DataAccessError } from "@/lib/db/assignments";
import {
  joinClassByName,
  setMyAvatarUrl,
  updateMyProfile,
} from "@/lib/db/profiles";
import {
  AVATAR_BUCKET,
  buildAvatarStoragePath,
  validateAvatarFile,
} from "@/lib/storage/avatars";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/features/classes/class-access";
import { toClassApiError } from "@/features/classes/errors";

export type SaveOnboardingResult = {
  profile: MyProfile;
  /** Null when the student left the class field empty. */
  classJoin: ClassJoinResult | null;
};

/**
 * Stores an optional new photo.
 *
 * The object is uploaded before the profile points at it. If the pointer update
 * fails, the object is removed so a failed save cannot leave an orphan avatar.
 */
async function storeAvatar(userId: string, avatar: File): Promise<void> {
  const validation = await validateAvatarFile(avatar);

  if (!validation.ok) {
    throw new ApiError(400, "invalid_file", validation.error);
  }

  const supabase = await createSupabaseServerClient();
  const storagePath = buildAvatarStoragePath(
    userId,
    validation.value.objectName,
  );

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, validation.value.bytes, {
      contentType: validation.value.mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("[profile] avatar upload failed", { code: uploadError.name });

    throw new ApiError(
      500,
      "upload_failed",
      "Could not store the photo. Try again.",
    );
  }

  const { data } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(storagePath);

  try {
    await setMyAvatarUrl(data.publicUrl);
  } catch (error) {
    const { error: cleanupError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove([storagePath]);

    if (cleanupError) {
      console.warn("[profile] avatar cleanup failed", {
        code: cleanupError.name,
      });
    }

    throw error;
  }
}

/**
 * Saves the onboarding form, then reports what happened to the typed class name.
 *
 * The profile is persisted first: a class that matches nothing, or that cannot
 * be joined, must not cost the student their other answers.
 */
export async function saveOnboardingProfile(
  input: ProfileOnboardingInput,
  avatar: File | null,
): Promise<SaveOnboardingResult> {
  const session = await requireSession();

  if (avatar) {
    await storeAvatar(session.user.id, avatar);
  }

  try {
    const profile = await updateMyProfile(input);
    const classJoin = input.className
      ? await joinClassByName(input.className)
      : null;

    return { profile, classJoin };
  } catch (error) {
    // A duplicate NIM is the only uniqueness rule this write can break; the
    // database is the source of truth, so a race is reported the same way.
    if (error instanceof DataAccessError && error.code === "23505") {
      throw new ApiError(409, "nim_taken", "That NIM is already registered.", {
        nim: "That NIM is already registered to another account.",
      });
    }

    throw toClassApiError(error, "Could not save your profile. Try again.");
  }
}

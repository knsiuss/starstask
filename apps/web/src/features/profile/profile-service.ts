import "server-only";

import type {
  ClassJoinResult,
  MyProfile,
  ProfileOnboardingInput,
} from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import { DataAccessError } from "@/lib/db/assignments";
import {
  joinOrCreateClass,
  setMyAvatarUrl,
  updateMyProfile,
} from "@/lib/db/profiles";
import {
  AVATAR_BUCKET,
  buildAvatarStoragePath,
  validateAvatarFile,
} from "@/lib/storage/avatars";
import {
  deleteStoredObject,
  isB2Configured,
  uploadToStorageWithKey,
} from "@/lib/storage/b2";
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
 * Returns the public URL the profile now points at.
 */
async function storeAvatar(userId: string, avatar: File): Promise<string> {
  const validation = await validateAvatarFile(avatar);

  if (!validation.ok) {
    throw new ApiError(400, "invalid_file", validation.error);
  }

  const storagePath = buildAvatarStoragePath(
    userId,
    validation.value.objectName,
  );

  // B2 is private, so the stored pointer is the streaming proxy route (same
  // URL-string shape the UI already renders). Without B2, keep the public
  // Supabase bucket behaviour.
  if (isB2Configured()) {
    const objectKey = `avatars/${storagePath}`;

    try {
      await uploadToStorageWithKey(
        objectKey,
        validation.value.bytes,
        validation.value.mimeType,
      );
    } catch {
      throw new ApiError(
        500,
        "upload_failed",
        "Could not store the photo. Try again.",
      );
    }

    const avatarUrl = `/api/media/${objectKey}`;

    try {
      await setMyAvatarUrl(avatarUrl);
    } catch (error) {
      await deleteStoredObject("b2", objectKey).catch(() => undefined);
      throw error;
    }

    return avatarUrl;
  }

  const supabase = await createSupabaseServerClient();

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

  return data.publicUrl;
}

/**
 * Replaces the signed-in user's photo from the settings page.
 *
 * Same validation and cleanup as onboarding; only the owner's own row is ever
 * written because the id comes from the verified session.
 */
export async function saveMyAvatar(avatar: File): Promise<string> {
  const session = await requireSession();

  return storeAvatar(session.user.id, avatar);
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
      ? await joinOrCreateClass(input.className)
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

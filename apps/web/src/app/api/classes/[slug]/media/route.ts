import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { setClassMedia } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  CLASS_MEDIA_BUCKET,
  CLASS_MEDIA_MAX_BYTES,
  buildClassMediaPath,
  validateClassImage,
} from "@/lib/storage/class-media";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FORM_BYTES = CLASS_MEDIA_MAX_BYTES + 16 * 1024;

type MediaKind = "avatar" | "cover";

function parseKind(value: FormDataEntryValue | string | null): MediaKind {
  return value === "cover" ? "cover" : "avatar";
}

/**
 * Replaces one of the class images.
 *
 * The upload and the pointer update are two steps: the object is stored first,
 * and if the row update fails the object is removed, so a failed save cannot
 * leave an orphan file. Authorization is checked twice — here through
 * `requireClassManager`, and again inside `set_class_media`.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "class:media",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 300,
    });

    const declaredLength = Number(request.headers.get("content-length") ?? "0");

    if (declaredLength > MAX_FORM_BYTES) {
      throw new ApiError(
        413,
        "file_too_large",
        "The image must be 4 MB or smaller.",
      );
    }

    const formData = await request.formData();
    const kind = parseKind(formData.get("kind"));
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      throw new ApiError(400, "invalid_file", "Choose a PNG or JPG image.");
    }

    const validation = await validateClassImage(file);

    if (!validation.ok) {
      throw new ApiError(400, "invalid_file", validation.error);
    }

    const supabase = await createSupabaseServerClient();
    const storagePath = buildClassMediaPath(
      found.id,
      validation.value.objectName,
    );

    const { error: uploadError } = await supabase.storage
      .from(CLASS_MEDIA_BUCKET)
      .upload(storagePath, validation.value.bytes, {
        contentType: validation.value.mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[class-media] upload failed", { code: uploadError.name });

      throw new ApiError(
        500,
        "upload_failed",
        "Could not store the image. Try again.",
      );
    }

    const { data } = supabase.storage
      .from(CLASS_MEDIA_BUCKET)
      .getPublicUrl(storagePath);

    const next = {
      avatarUrl: kind === "avatar" ? data.publicUrl : found.avatar_url,
      coverUrl: kind === "cover" ? data.publicUrl : found.cover_url,
    };

    try {
      await setClassMedia(found.id, next);
    } catch (error) {
      const { error: cleanupError } = await supabase.storage
        .from(CLASS_MEDIA_BUCKET)
        .remove([storagePath]);

      if (cleanupError) {
        console.warn("[class-media] cleanup failed", {
          code: cleanupError.name,
        });
      }

      throw error;
    }

    return apiSuccess(next);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Removes one image and restores the default. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "class:media",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 300,
    });

    const kind = parseKind(new URL(request.url).searchParams.get("kind"));

    const next = {
      avatarUrl: kind === "avatar" ? null : found.avatar_url,
      coverUrl: kind === "cover" ? null : found.cover_url,
    };

    await setClassMedia(found.id, next);

    return apiSuccess(next);
  } catch (error) {
    return handleRouteError(error);
  }
}

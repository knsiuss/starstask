import { ApiError } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { validateAvatarFile } from "@/lib/storage/avatars";
import { isB2Configured, uploadToStorageWithKey } from "@/lib/storage/b2";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

const CLASS_MEDIA_BUCKET = "class-media";

/**
 * Uploads one branding logo (PNG/JPG, 2 MB max). The validation is the avatar
 * validator: extension + magic bytes, never the browser's declared MIME type.
 * Returns the URL the form stores in the branding config.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const { class: found } = await requireClassManager(slug);

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "invalid_input", "Choose an image to upload.");
    }

    const validation = await validateAvatarFile(file);

    if (!validation.ok) {
      throw new ApiError(400, "invalid_file", validation.error);
    }

    const kind = form.get("kind");
    const logoKind = kind === "product" ? "product" : "university";
    const objectName = validation.value.objectName;
    const url = await storeLogo(found.id, objectName, validation.value);

    return apiSuccess({ url, kind: logoKind }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

async function storeLogo(
  classId: string,
  objectName: string,
  value: { bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" },
): Promise<string> {
  const storagePath = `${classId}/branding/${objectName}`;

  if (isB2Configured()) {
    const objectKey = `${CLASS_MEDIA_BUCKET}/${storagePath}`;

    try {
      await uploadToStorageWithKey(
        objectKey,
        value.bytes,
        value.mimeType,
      );
    } catch {
      throw new ApiError(
        500,
        "upload_failed",
        "Could not store the logo. Try again.",
      );
    }

    return `/api/media/${objectKey}`;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from(CLASS_MEDIA_BUCKET)
    .upload(storagePath, value.bytes, {
      contentType: value.mimeType,
      upsert: false,
    });

  if (error) {
    throw new ApiError(
      500,
      "upload_failed",
      "Could not store the logo. Try again.",
    );
  }

  const { data } = supabase.storage
    .from(CLASS_MEDIA_BUCKET)
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

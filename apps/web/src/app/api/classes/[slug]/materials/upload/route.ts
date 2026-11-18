import { requireClassManager } from "@/features/classes/class-access";
import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getClassSubject } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { uploadCourseMediaFile } from "@/lib/storage/course-media";

export const dynamic = "force-dynamic";

const SAFE_MATERIAL_UPLOAD_MESSAGES = new Set([
  "File must be between 1 byte and 10 MB.",
  "Supported files: PDF, HTML, Markdown, TXT, PNG, JPG, or WebP.",
  "File contents do not match its file extension.",
  "Could not upload the file right now.",
]);

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
      action: "classes:materials:upload",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const formData = await request.formData();
    const subjectId = String(formData.get("subjectId") ?? "");
    const file = formData.get("file");

    const course = subjectId
      ? await getClassSubject(found.id, subjectId)
      : null;

    if (!course) {
      throw new ApiError(422, "invalid_course", "Choose a valid course.");
    }

    if (!(file instanceof File)) {
      throw new ApiError(422, "invalid_file", "Select a file to upload.");
    }

    const uploaded = await uploadCourseMediaFile({
      classId: found.id,
      subjectId: course.id,
      folder: "materials",
      file,
    }).catch((error: unknown) => {
      const message =
        error instanceof Error &&
        SAFE_MATERIAL_UPLOAD_MESSAGES.has(error.message)
          ? error.message
          : "Could not upload file.";
      throw new ApiError(422, "invalid_file", message);
    });

    return apiSuccess(uploaded, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

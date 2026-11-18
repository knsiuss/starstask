import { courseCommentCreateSchema, toFieldErrors } from "@starstask/contracts";

import { requireClassMember } from "@/features/classes/class-access";
import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getClassSubject } from "@/lib/db/classes";
import { canAccessCourse } from "@/lib/db/course-access";
import {
  createCourseComment,
  listCourseComments,
} from "@/lib/db/course-comments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { uploadCourseMediaFile } from "@/lib/storage/course-media";

export const dynamic = "force-dynamic";

const SAFE_COMMENT_UPLOAD_MESSAGES = new Set([
  "File must be between 1 byte and 10 MB.",
  "Only PNG, JPG, or WebP images are supported in comments.",
  "File contents do not match its file extension.",
  "Could not upload the file right now.",
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; courseId: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, courseId } = await context.params;
    const { session, class: found, role } = await requireClassMember(slug);
    const course = await getClassSubject(found.id, courseId);

    if (
      !course ||
      (!role.canManage &&
        !(await canAccessCourse(found.id, session.user.id, course.id)))
    ) {
      throw new ApiError(404, "not_found", "Course not found.");
    }

    const comments = await listCourseComments({
      classId: found.id,
      subjectId: course.id,
      viewerId: session.user.id,
      canManage: role.canManage,
    });

    return apiSuccess({ comments });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; courseId: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, courseId } = await context.params;
    const { session, class: found, role } = await requireClassMember(slug);
    const course = await getClassSubject(found.id, courseId);

    if (
      !course ||
      (!role.canManage &&
        !(await canAccessCourse(found.id, session.user.id, course.id)))
    ) {
      throw new ApiError(404, "not_found", "Course not found.");
    }

    await enforceRateLimit({
      action: "classes:courses:comments:create",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const contentType = request.headers.get("content-type") ?? "";
    let rawPayload: Record<string, unknown>;
    let imageFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const rawMeeting = formData.get("meetingNumber");
      const rawParent = formData.get("parentId");
      const maybeFile = formData.get("image");

      rawPayload = {
        body: String(formData.get("body") ?? ""),
        meetingNumber:
          rawMeeting !== null && String(rawMeeting).trim() !== ""
            ? Number(rawMeeting)
            : null,
        parentId:
          rawParent !== null && String(rawParent).trim() !== ""
            ? String(rawParent)
            : null,
      };

      if (maybeFile instanceof File && maybeFile.size > 0) {
        imageFile = maybeFile;
      }
    } else {
      rawPayload = (await request.json()) as Record<string, unknown>;
    }

    const parsed = courseCommentCreateSchema.safeParse(rawPayload);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check your comment.",
        toFieldErrors(parsed.error),
      );
    }

    let imagePath: string | null = null;
    let imageMime: string | null = null;

    if (imageFile) {
      const uploaded = await uploadCourseMediaFile({
        classId: found.id,
        subjectId: course.id,
        folder: "comments",
        file: imageFile,
      }).catch((error: unknown) => {
        const message =
          error instanceof Error &&
          SAFE_COMMENT_UPLOAD_MESSAGES.has(error.message)
            ? error.message
            : "Invalid image.";
        throw new ApiError(422, "invalid_file", message);
      });

      imagePath = uploaded.path;
      imageMime = uploaded.mimeType;
    }

    const id = await createCourseComment({
      classId: found.id,
      subjectId: course.id,
      authorId: session.user.id,
      input: parsed.data,
      imagePath,
      imageMime,
    });

    const comments = await listCourseComments({
      classId: found.id,
      subjectId: course.id,
      viewerId: session.user.id,
      canManage: role.canManage,
    });

    return apiSuccess({ id, comments }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

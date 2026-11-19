import { z } from "zod";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getClassSubject } from "@/lib/db/classes";
import { getMemberCourseAccess } from "@/lib/db/course-access";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClass, requireSession } from "@/features/classes/class-access";
import { leaveMyCourse } from "@/features/classes/self-leave-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_JSON_BYTES = 1024;

/** Empty object; authoritative identity comes from the session. */
const leaveSchema = z.object({}).strict();

const uuidSchema = z.uuid("Invalid course id");

/**
 * Caller leaves one course inside a class they belong to.
 *
 * Only members whose `course_scope` is `selected` have rows in
 * `class_member_courses`; members with scope `all` hold implicit access to
 * every course and must leave the class instead. The RPC re-checks scope
 * server-side and raises 22023, so the route fails fast with a 422 before
 * touching the database.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; courseId: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "classes:courses:leave",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 300,
      onBackendFailure: "closed",
    });

    const parsed = leaveSchema.safeParse(await readJson(request));

    if (!parsed.success) {
      throw new ApiError(422, "validation_error", "Send an empty body.");
    }

    const { slug, courseId } = await context.params;
    const parsedCourseId = uuidSchema.safeParse(courseId);

    if (!parsedCourseId.success) {
      throw new ApiError(404, "not_found", "Course not found.");
    }

    const found = await requireClass(slug);
    const subject = await getClassSubject(found.id, parsedCourseId.data);

    if (!subject) {
      throw new ApiError(404, "not_found", "Course not found in this class.");
    }

    const access = await getMemberCourseAccess(found.id, session.user.id);

    if (access.scope !== "selected") {
      throw new ApiError(
        422,
        "not_selected_course",
        "Members with full course access must leave the class instead.",
      );
    }

    if (!access.allowedSubjectIds.has(subject.id)) {
      throw new ApiError(
        422,
        "not_selected_course",
        "You are not enrolled in this course.",
      );
    }

    const result = await leaveMyCourse(session, found.id, subject.id);

    return apiSuccess({ status: result.status });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function readJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new ApiError(
      413,
      "payload_too_large",
      "The request body is too large.",
    );
  }

  try {
    const text = await request.text();

    if (text.trim() === "") {
      return {};
    }

    return JSON.parse(text);
  } catch {
    throw new ApiError(
      400,
      "invalid_json",
      "The request body could not be read.",
    );
  }
}

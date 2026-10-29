import {
  assignmentIdSchema,
  assignmentUpdateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import {
  ApiError,
  notFound,
  serviceUnavailable,
  unauthorized,
} from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { toPublicAssignment } from "@/lib/api/serializers";
import { getSessionUser } from "@/lib/auth/session";
import {
  getAssignmentDetail,
  getOrCreateCourse,
  updateAssignmentRecord,
} from "@/lib/db/assignments";
import { isSupabaseConfigured } from "@/lib/env/public";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";
import { deleteAssignmentForUser } from "@/features/assignments/assignment-service";

const MAX_JSON_BYTES = 64 * 1024;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    await enforceRateLimit({
      action: "assignments:detail",
      identifier: getClientIdentifier(request),
      limit: 180,
      windowSeconds: 60,
    });

    const id = parseId(await context.params);
    const assignment = await getAssignmentDetail(id);

    if (!assignment) {
      throw notFound();
    }

    return apiSuccess(toPublicAssignment(assignment));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "assignments:update",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const declaredLength = Number(request.headers.get("content-length") ?? "0");

    if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
      throw new ApiError(
        413,
        "payload_too_large",
        "The request body is too large.",
      );
    }

    const id = parseId(await context.params);

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new ApiError(
        400,
        "invalid_json",
        "The request body could not be read.",
      );
    }

    const parsed = assignmentUpdateSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    let courseId: string | null = null;

    if (parsed.data.courseName !== undefined) {
      const course = await getOrCreateCourse(
        parsed.data.courseName,
        parsed.data.courseCode,
        parsed.data.department,
      );
      courseId = course.id;
    }

    const updated = await updateAssignmentRecord(
      session.user.id,
      id,
      parsed.data,
      courseId,
    );

    if (!updated) {
      throw notFound();
    }

    return apiSuccess({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "assignments:delete",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 3600,
    });

    const id = parseId(await context.params);
    const deleted = await deleteAssignmentForUser(session.user.id, id);

    if (!deleted) {
      throw notFound();
    }

    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function parseId(params: { id: string }): string {
  const parsed = assignmentIdSchema.safeParse(params.id);

  if (!parsed.success) {
    throw new ApiError(400, "invalid_id", "The assignment id is invalid.");
  }

  return parsed.data;
}

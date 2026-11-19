import { toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiError, apiSuccess, handleRouteError } from "@/lib/api/responses";
import { DataAccessError } from "@/lib/db/assignments";
import { isLecturer } from "@/lib/auth/lecturer";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import {
  createClassAsLecturer,
  slugifyLecturerClassName,
} from "@/lib/db/lecturer-create";
import { lecturerCreateClassSchema } from "@/features/classes/lecturer-create-schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_JSON_BYTES = 8 * 1024;

/**
 * Direct class creation for the lecturer persona.
 *
 * The lecturer is a trusted persona and is not bound to the student
 * eight-active-class cap; `create_class_as_lecturer` enforces an active
 * lecturer or university_admin membership instead, and gives the creator
 * class_admins plus the 8 manage_* permissions. Non-lecturer callers get 403.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    if (!(await isLecturer())) {
      throw new ApiError(
        403,
        "lecturer_only",
        "Only lecturers can create a class here.",
      );
    }

    await enforceRateLimit({
      action: "classes:create-lecturer",
      identifier: session.user.id,
      limit: 10,
      windowSeconds: 300,
      onBackendFailure: "closed",
    });

    const body = await readJson(request);
    const parsed = lecturerCreateClassSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const slug = slugifyLecturerClassName(parsed.data.name);

    try {
      const { classId } = await createClassAsLecturer({
        slug,
        name: parsed.data.name,
        courseName: parsed.data.courseName,
        semester: parsed.data.semester,
        academicYear: parsed.data.academicYear,
        description: parsed.data.description,
        institution: parsed.data.institution,
        lecturerName: parsed.data.lecturerName,
        classCode: parsed.data.classCode,
        universityId: parsed.data.universityId,
      });

      return apiSuccess({ classId, slug, name: parsed.data.name });
    } catch (error) {
      if (error instanceof DataAccessError) {
        if (error.code === "23505") {
          return apiError(
            409,
            "slug_taken",
            "That class already exists for this semester and academic year. Choose a different name or join the existing class.",
            {
              name: "A class with this name in the same period already exists.",
            },
          );
        }

        if (
          error.code === "22023" &&
          error.message.includes("multiple university memberships")
        ) {
          return apiError(
            422,
            "pick_university",
            "Pilih university: kamu punya lebih dari satu membership lecturer aktif",
          );
        }

        if (error.code === "42501") {
          return apiError(
            403,
            "lecturer_only",
            "Only lecturers can create a class here.",
          );
        }

        console.error("[classes:create-lecturer]", {
          code: error.code,
          name: error.name,
        });

        return apiError(
          503,
          "create_unavailable",
          "Could not create your class right now. Please try again.",
        );
      }

      throw error;
    }
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
    return await request.json();
  } catch {
    throw new ApiError(
      400,
      "invalid_json",
      "The request body could not be read.",
    );
  }
}

import { z } from "zod";

import {
  developerIncidentNoteSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireDeveloperApiAccess } from "@/lib/auth/developer";
import { DataAccessError } from "@/lib/db/assignments";
import { addDeveloperIncidentNote } from "@/lib/db/developer-operations";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const incidentIdSchema = z.uuid();

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireDeveloperApiAccess();

    await enforceRateLimit({
      action: "developer:incidents:notes",
      identifier: getClientIdentifier(request),
      limit: 60,
      windowSeconds: 3600,
    });

    if (!isServiceRoleConfigured()) {
      throw serviceUnavailable();
    }

    const { id } = await context.params;
    const parsedId = incidentIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(404, "not_found", "That incident was not found.");
    }

    const parsed = developerIncidentNoteSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    let note;

    try {
      note = await addDeveloperIncidentNote(
        session.user.id,
        parsedId.data,
        parsed.data.body,
      );
    } catch (error) {
      if (
        error instanceof DataAccessError &&
        error.code === "not_found"
      ) {
        throw new ApiError(404, "not_found", "That incident was not found.");
      }

      throw error;
    }

    return apiSuccess({ note }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export const runtime = "nodejs";

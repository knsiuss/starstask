import "server-only";

import type { SessionUser } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Self-scope leave RPCs for a class or for one course inside it.
 *
 * Both functions are SECURITY DEFINER and derive the actor from auth.uid();
 * the caller's session only gates the route, not the database. The hand-written
 * Database type does not declare these RPCs, so call sites use a single
 * `as never` cast, mirroring isLecturer.
 */
type SelfLeaveClassResult = {
  status?: string;
  promoted_user_id?: string | null;
};

type SelfLeaveCourseResult = { status?: string };

/**
 * Maps the RPC failure modes to route-visible ApiErrors. The provider message
 * never reaches the client; only fixed, safe copy does.
 */
function toSelfLeaveError(
  error: { code?: string; message?: string } | null,
): ApiError {
  const code = error?.code;

  if (code === "22023") {
    return new ApiError(
      409,
      "invalid_state",
      "A class must keep at least one admin, or promote another member first.",
    );
  }

  if (code === "P0002") {
    return new ApiError(
      404,
      "not_a_member",
      "You are not a member of this class.",
    );
  }

  if (code === "42501") {
    return new ApiError(403, "forbidden", "Sign in to perform this action.");
  }

  if (code) {
    // Log the code only; raw messages can embed SQL fragments.
    console.error("[self-leave] unexpected database error", { code });
  }

  return new ApiError(
    503,
    "leave_unavailable",
    "Could not complete the request right now. Please try again.",
  );
}

/**
 * Reads the promoted successor from the leave_my_class RPC payload.
 *
 * Returns null when the RPC reported no promotion (the caller was not the
 * last admin, or the class is now empty). Non-string values are ignored.
 */
export function promotionFromResult(
  result: SelfLeaveClassResult | null | undefined,
): string | null {
  const promoted = result?.promoted_user_id;

  return typeof promoted === "string" && promoted.length > 0 ? promoted : null;
}

/**
 * Removes the caller from one class via `leave_my_class`.
 *
 * The RPC handles last-admin auto-promotion (longest-tenured member by
 * joined_at ASC, tie-break user_id) inside the same transaction; this wrapper
 * only normalizes the failure modes.
 */
export async function leaveMyClass(
  _session: SessionUser,
  classId: string,
): Promise<{ status: string; promotedUserId: string | null }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "leave_my_class" as never,
    { p_class_id: classId } as never,
  );

  if (error) {
    throw toSelfLeaveError(error);
  }

  const result = (data ?? null) as SelfLeaveClassResult | null;

  return {
    status: typeof result?.status === "string" ? result.status : "left",
    promotedUserId: promotionFromResult(result),
  };
}

/** Removes the caller from one selected course via `leave_my_course`. */
export async function leaveMyCourse(
  _session: SessionUser,
  classId: string,
  subjectId: string,
): Promise<{ status: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "leave_my_course" as never,
    { p_class_id: classId, p_subject_id: subjectId } as never,
  );

  if (error) {
    throw toSelfLeaveError(error);
  }

  const result = (data ?? null) as SelfLeaveCourseResult | null;

  return {
    status: typeof result?.status === "string" ? result.status : "left",
  };
}

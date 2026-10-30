import "server-only";

import {
  createSupabaseAdminClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

/**
 * Best-effort monitoring writes.
 *
 * Monitoring must never break the operation it observes, so every write is
 * skipped when the service role is absent and every failure is swallowed after
 * a non-sensitive warning. These helpers are called only from server code.
 */

export type AuthActivityInput = {
  eventType: "sign_in_succeeded" | "sign_in_failed";
  userId: string | null;
  provider?: string | null;
  reason?: string | null;
};

export async function recordAuthActivity(
  input: AuthActivityInput,
): Promise<void> {
  if (!isServiceRoleConfigured()) {
    return;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("auth_activity_events").insert({
      user_id: input.userId,
      event_type: input.eventType,
      provider: input.provider ?? null,
      reason: input.reason ?? null,
    });

    if (error) {
      console.warn("[observability] auth activity not recorded", {
        code: error.code,
      });
    }
  } catch (error) {
    console.warn("[observability] auth activity write failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
  }
}

export type AppActivityInput = {
  actorId: string;
  eventType: "assignment_created" | "assignment_updated" | "assignment_deleted";
  resourceType: "assignment";
  resourceId: string;
  classId?: string | null;
};

export async function recordAppActivity(
  input: AppActivityInput,
): Promise<void> {
  if (!isServiceRoleConfigured()) {
    return;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("app_activity_events").insert({
      actor_id: input.actorId,
      event_type: input.eventType,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      class_id: input.classId ?? null,
      metadata: {},
    });

    if (error) {
      console.warn("[observability] app activity not recorded", {
        code: error.code,
      });
    }
  } catch (error) {
    console.warn("[observability] app activity write failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
  }
}

export type ErrorActivityInput = {
  routePath: string | null;
  method: string | null;
  errorName: string | null;
  errorDigest: string | null;
};

const MAX_ROUTE_PATH = 300;
const MAX_METHOD = 16;
const MAX_ERROR_NAME = 100;
const MAX_DIGEST = 100;

function clean(value: string | null | undefined, maxLength: number) {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);

  return cleaned.length > 0 ? cleaned : null;
}

/** Stores only a route template, HTTP method, and error identity. */
export async function recordErrorActivity(
  input: ErrorActivityInput,
): Promise<void> {
  if (!isServiceRoleConfigured()) {
    return;
  }

  const routePath = clean(input.routePath, MAX_ROUTE_PATH);
  const method = clean(input.method, MAX_METHOD);
  const errorName = clean(input.errorName, MAX_ERROR_NAME);
  const errorDigest = clean(input.errorDigest, MAX_DIGEST);

  if (!routePath && !errorName) {
    return;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("app_error_events").insert({
      route_path: routePath,
      method: method ? method.toUpperCase() : null,
      error_name: errorName,
      error_digest: errorDigest,
    });

    if (error) {
      console.warn("[observability] error event not recorded", {
        code: error.code,
      });
    }
  } catch (error) {
    console.warn("[observability] error event write failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
  }
}

export function getErrorDigest(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string"
  ) {
    return error.digest;
  }

  return null;
}

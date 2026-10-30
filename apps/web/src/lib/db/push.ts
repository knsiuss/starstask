import "server-only";

import type {
  NotificationPreferencesInput,
  PushSubscriptionInput,
} from "@starstask/contracts";
import { DEFAULT_NOTIFICATION_TIMEZONE } from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NotificationPreferences = {
  pushEnabled: boolean;
  reminder24h: boolean;
  reminder3h: boolean;
  sessionReminder24h: boolean;
  sessionReminder3h: boolean;
  timezone: string;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: false,
  reminder24h: true,
  reminder3h: true,
  sessionReminder24h: true,
  sessionReminder3h: true,
  timezone: DEFAULT_NOTIFICATION_TIMEZONE,
};

// Postgres `unique_violation`: another tab created the row between our
// UPDATE and INSERT.
const UNIQUE_VIOLATION = "23505";

export type PushDevice = {
  id: string;
  device_label: string | null;
  created_at: string;
  last_success_at: string | null;
};

export type SavedAssignmentSummary = {
  id: string;
  assignment_id: string;
  title: string;
  course_name: string;
  deadline: string | null;
  created_at: string;
};

/**
 * Reads the caller's preferences. A missing row means "never opted in", which
 * is the same shape as the table defaults, so the UI never needs a null branch.
 */
export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select(
      "push_enabled, reminder_24h, reminder_3h, session_reminder_24h, session_reminder_3h, timezone",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new DataAccessError(
      "Could not load notification preferences",
      error.code,
    );
  }

  if (!data) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  return {
    pushEnabled: data.push_enabled,
    reminder24h: data.reminder_24h,
    reminder3h: data.reminder_3h,
    sessionReminder24h: data.session_reminder_24h,
    sessionReminder3h: data.session_reminder_3h,
    timezone: data.timezone,
  };
}

/** Applies a partial preference patch and returns the merged result. */
export async function updateNotificationPreferences(
  userId: string,
  patch: NotificationPreferencesInput,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId);
  const merged: NotificationPreferences = {
    pushEnabled: patch.pushEnabled ?? current.pushEnabled,
    reminder24h: patch.reminder24h ?? current.reminder24h,
    reminder3h: patch.reminder3h ?? current.reminder3h,
    sessionReminder24h: patch.sessionReminder24h ?? current.sessionReminder24h,
    sessionReminder3h: patch.sessionReminder3h ?? current.sessionReminder3h,
    timezone: patch.timezone ?? current.timezone,
  };

  const values = {
    push_enabled: merged.pushEnabled,
    reminder_24h: merged.reminder24h,
    reminder_3h: merged.reminder3h,
    session_reminder_24h: merged.sessionReminder24h,
    session_reminder_3h: merged.sessionReminder3h,
    timezone: merged.timezone,
  };
  const supabase = await createSupabaseServerClient();

  // A plain UPDATE keeps `user_id` out of the statement. The table grants
  // UPDATE only on the preference columns, so an upsert (whose
  // `ON CONFLICT DO UPDATE` also assigns `user_id`) is rejected with 42501.
  const { data, error } = await supabase
    .from("notification_preferences")
    .update(values)
    .eq("user_id", userId)
    .select("user_id");

  if (error) {
    throw new DataAccessError(
      "Could not save notification preferences",
      error.code,
    );
  }

  if (data && data.length > 0) {
    return merged;
  }

  const { error: insertError } = await supabase
    .from("notification_preferences")
    .insert({ user_id: userId, ...values });

  if (!insertError) {
    return merged;
  }

  if (insertError.code !== UNIQUE_VIOLATION) {
    throw new DataAccessError(
      "Could not save notification preferences",
      insertError.code,
    );
  }

  // Two tabs can race the first write. The loser hits the primary key, so it
  // re-applies the update instead of failing the request.
  const { error: retryError } = await supabase
    .from("notification_preferences")
    .update(values)
    .eq("user_id", userId);

  if (retryError) {
    throw new DataAccessError(
      "Could not save notification preferences",
      retryError.code,
    );
  }

  return merged;
}

export async function listPushDevices(userId: string): Promise<PushDevice[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, device_label, created_at, last_success_at")
    .eq("user_id", userId)
    .is("disabled_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new DataAccessError("Could not load your devices", error.code);
  }

  return data ?? [];
}

/**
 * Registers the current browser's subscription.
 *
 * Returns `null` when the endpoint already belongs to another account: the
 * database function refuses to transfer ownership, and the API reports a
 * generic failure instead of confirming that the endpoint exists.
 */
export async function registerPushSubscription(
  input: PushSubscriptionInput,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: input.endpoint,
    p_p256dh: input.keys.p256dh,
    p_auth: input.keys.auth,
    p_device_label: input.deviceLabel ?? null,
  });

  if (error) {
    throw new DataAccessError("Could not register this device", error.code);
  }

  return data;
}

/** Deletes only a device row owned by `userId`; RLS enforces the same rule. */
export async function deletePushDevice(
  userId: string,
  deviceId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("id", deviceId)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    throw new DataAccessError("Could not remove this device", error.code);
  }

  return (data ?? []).length > 0;
}

/**
 * Removes the subscription for an endpoint owned by the caller.
 *
 * Used when the browser unsubscribes itself: the client knows its endpoint but
 * not the database id. Endpoints are not readable by clients, so the delete
 * runs through a caller-scoped definer function instead of a table filter.
 */
export async function deletePushDeviceByEndpoint(
  endpoint: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("delete_push_subscription", {
    p_endpoint: endpoint,
  });

  if (error) {
    throw new DataAccessError("Could not remove this device", error.code);
  }

  return data ?? false;
}

export async function listSavedAssignments(
  userId: string,
): Promise<SavedAssignmentSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("saved_assignments")
    .select(
      `id,
       assignment_id,
       created_at,
       assignments!saved_assignments_assignment_id_fkey (
         title,
         deadline,
         courses!assignments_course_id_fkey ( name )
       )`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new DataAccessError("Could not load saved assignments", error.code);
  }

  return (data ?? []).flatMap((row) =>
    row.assignments
      ? [
          {
            id: row.id,
            assignment_id: row.assignment_id,
            title: row.assignments.title,
            course_name: row.assignments.courses?.name ?? "Unknown course",
            deadline: row.assignments.deadline,
            created_at: row.created_at,
          },
        ]
      : [],
  );
}

export async function addSavedAssignment(
  userId: string,
  assignmentId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("saved_assignments")
    .upsert(
      { user_id: userId, assignment_id: assignmentId },
      { onConflict: "user_id,assignment_id", ignoreDuplicates: true },
    );

  if (error) {
    throw new DataAccessError("Could not save this assignment", error.code);
  }
}

export async function removeSavedAssignment(
  userId: string,
  assignmentId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("saved_assignments")
    .delete()
    .eq("user_id", userId)
    .eq("assignment_id", assignmentId);

  if (error) {
    throw new DataAccessError(
      "Could not remove this saved assignment",
      error.code,
    );
  }
}

export async function isAssignmentSaved(
  userId: string,
  assignmentId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("saved_assignments")
    .select("id")
    .eq("user_id", userId)
    .eq("assignment_id", assignmentId)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not check saved state", error.code);
  }

  return data !== null;
}

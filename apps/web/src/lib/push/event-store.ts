import "server-only";

import {
  createSupabaseReminderStore,
  PushStoreError,
  type StoredSubscription,
} from "@/lib/push/store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { NotificationEventClaim } from "@/types/database";

export type NotificationEventStatus = "sent" | "failed" | "skipped" | "pending";

/**
 * Storage contract for the one-off event queue. Kept as an interface so the
 * scheduler can be tested with in-memory fakes and a pinned clock.
 */
export interface NotificationEventStore {
  claimEvents(
    nowIso: string,
    limit: number,
  ): Promise<NotificationEventClaim[]>;
  completeEvent(
    id: string,
    status: NotificationEventStatus,
    errorCategory: string | null,
    nextAttemptAt: string | null,
  ): Promise<boolean>;
  loadActiveSubscriptions(userIds: string[]): Promise<StoredSubscription[]>;
  markSubscriptionSuccess(subscriptionId: string, atIso: string): Promise<void>;
  disableSubscription(subscriptionId: string, atIso: string): Promise<void>;
}

/**
 * Service-role store for the event queue.
 *
 * Claiming a batch across users must bypass RLS, and granting that to
 * `authenticated` would let a client read or mutate other users' rows. The
 * device helpers are delegated to the reminder store instead of duplicated.
 */
export function createSupabaseNotificationEventStore(): NotificationEventStore {
  const supabase = createSupabaseAdminClient();
  const devices = createSupabaseReminderStore();

  return {
    async claimEvents(nowIso, limit) {
      const { data, error } = await supabase.rpc("claim_notification_events", {
        p_now: nowIso,
        p_limit: limit,
      });

      if (error) {
        throw new PushStoreError("Could not claim events", error.code);
      }

      return data ?? [];
    },

    async completeEvent(id, status, errorCategory, nextAttemptAt) {
      const { data, error } = await supabase.rpc(
        "complete_notification_event",
        {
          p_id: id,
          p_status: status,
          p_error_category: errorCategory,
          p_next_attempt_at: nextAttemptAt,
        },
      );

      if (error) {
        throw new PushStoreError("Could not record event outcome", error.code);
      }

      return data === true;
    },

    loadActiveSubscriptions: (userIds) =>
      devices.loadActiveSubscriptions(userIds),
    markSubscriptionSuccess: (subscriptionId, atIso) =>
      devices.markSubscriptionSuccess(subscriptionId, atIso),
    disableSubscription: (subscriptionId, atIso) =>
      devices.disableSubscription(subscriptionId, atIso),
  };
}

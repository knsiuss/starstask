import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PushTarget } from "@/lib/push/sender";
import type {
  Database,
  DeliveryStatusRow,
  PushDeliveryClaim,
} from "@/types/database";

export class PushStoreError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PushStoreError";
  }
}

export type CandidateAssignment = {
  id: string;
  ownerId: string;
  deadline: string;
};

export type AudienceEntry = {
  assignmentId: string;
  userId: string;
  timezone: string;
  reminder24h: boolean;
  reminder3h: boolean;
};

export type StoredSubscription = PushTarget & { userId: string };

export type DeliveryInsert =
  Database["public"]["Tables"]["notification_deliveries"]["Insert"];

/** Rows per insert statement; keeps each PostgREST body small. */
const INSERT_CHUNK_SIZE = 500;

/** Upper bound on assignments considered per run, so one run stays bounded. */
const MAX_CANDIDATES = 200;

/**
 * Storage contract used by the scheduler. Keeping it an interface lets tests
 * run the whole orchestration against in-memory fakes with a pinned clock.
 */
export interface ReminderStore {
  listCandidateAssignments(
    nowIso: string,
    horizonIso: string,
  ): Promise<CandidateAssignment[]>;
  listAudience(assignmentIds: string[]): Promise<AudienceEntry[]>;
  enqueueDeliveries(rows: DeliveryInsert[]): Promise<number>;
  claimDeliveries(nowIso: string, limit: number): Promise<PushDeliveryClaim[]>;
  completeDelivery(
    id: string,
    status: DeliveryStatusRow,
    errorCategory: string | null,
    nextAttemptAt: string | null,
  ): Promise<boolean>;
  loadActiveSubscriptions(userIds: string[]): Promise<StoredSubscription[]>;
  markSubscriptionSuccess(subscriptionId: string, atIso: string): Promise<void>;
  disableSubscription(subscriptionId: string, atIso: string): Promise<void>;
}

export function createSupabaseReminderStore(): ReminderStore {
  const supabase = createSupabaseAdminClient();

  return {
    async listCandidateAssignments(nowIso, horizonIso) {
      const { data, error } = await supabase
        .from("assignments")
        .select("id, user_id, deadline")
        .eq("status", "published")
        .not("deadline", "is", null)
        .gt("deadline", nowIso)
        .lte("deadline", horizonIso)
        .order("deadline", { ascending: true })
        .limit(MAX_CANDIDATES);

      if (error) {
        throw new PushStoreError(
          "Could not load candidate assignments",
          error.code,
        );
      }

      return (data ?? []).flatMap((row) =>
        row.deadline
          ? [{ id: row.id, ownerId: row.user_id, deadline: row.deadline }]
          : [],
      );
    },

    async listAudience(assignmentIds) {
      if (assignmentIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase.rpc("list_reminder_audience", {
        p_assignment_ids: assignmentIds,
      });

      if (error) {
        throw new PushStoreError(
          "Could not load reminder audience",
          error.code,
        );
      }

      return (data ?? []).map((row) => ({
        assignmentId: row.assignment_id,
        userId: row.user_id,
        timezone: row.pref_timezone,
        reminder24h: row.reminder_24h,
        reminder3h: row.reminder_3h,
      }));
    },

    async enqueueDeliveries(rows) {
      let inserted = 0;

      for (let index = 0; index < rows.length; index += INSERT_CHUNK_SIZE) {
        const chunk = rows.slice(index, index + INSERT_CHUNK_SIZE);
        const { error, count } = await supabase
          .from("notification_deliveries")
          // The unique key makes repeated runs idempotent, and a changed
          // deadline creates a new logical reminder instead of reusing a row.
          .upsert(chunk, {
            onConflict: "user_id,assignment_id,reminder_type,deadline_at",
            ignoreDuplicates: true,
            count: "exact",
          });

        if (error) {
          throw new PushStoreError("Could not enqueue reminders", error.code);
        }

        inserted += count ?? 0;
      }

      return inserted;
    },

    async claimDeliveries(nowIso, limit) {
      const { data, error } = await supabase.rpc(
        "claim_notification_deliveries",
        {
          p_now: nowIso,
          p_limit: limit,
        },
      );

      if (error) {
        throw new PushStoreError("Could not claim reminders", error.code);
      }

      return data ?? [];
    },

    async completeDelivery(id, status, errorCategory, nextAttemptAt) {
      const { data, error } = await supabase.rpc(
        "complete_notification_delivery",
        {
          p_id: id,
          p_status: status,
          p_error_category: errorCategory,
          p_next_attempt_at: nextAttemptAt,
        },
      );

      if (error) {
        throw new PushStoreError(
          "Could not record delivery outcome",
          error.code,
        );
      }

      return data === true;
    },

    async loadActiveSubscriptions(userIds) {
      if (userIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth")
        .in("user_id", userIds)
        .is("disabled_at", null);

      if (error) {
        throw new PushStoreError(
          "Could not load push subscriptions",
          error.code,
        );
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
      }));
    },

    async markSubscriptionSuccess(subscriptionId, atIso) {
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ last_success_at: atIso })
        .eq("id", subscriptionId);

      if (error) {
        throw new PushStoreError("Could not update subscription", error.code);
      }
    },

    async disableSubscription(subscriptionId, atIso) {
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ disabled_at: atIso })
        .eq("id", subscriptionId);

      if (error) {
        throw new PushStoreError("Could not disable subscription", error.code);
      }
    },
  };
}

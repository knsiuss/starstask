import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PushStoreError, type StoredSubscription } from "@/lib/push/store";
import type { Database, SessionReminderClaim } from "@/types/database";

export type CandidateSession = {
  id: string;
  startsAt: string;
};

export type SessionAudienceEntry = {
  sessionId: string;
  userId: string;
  timezone: string;
  reminder24h: boolean;
  reminder3h: boolean;
};

export type SessionReminderInsert =
  Database["public"]["Tables"]["discussion_session_reminders"]["Insert"];

/** Rows per insert; keeps each PostgREST body small. */
const INSERT_CHUNK_SIZE = 500;

/** Upper bound on sessions considered per run. */
const MAX_CANDIDATES = 200;

/**
 * Storage contract for the session reminder scheduler.
 *
 * An interface, not a concrete client, so the orchestration can be tested with
 * an in-memory fake and a pinned clock.
 */
export interface SessionReminderStore {
  listCandidateSessions(
    nowIso: string,
    horizonIso: string,
  ): Promise<CandidateSession[]>;
  listAudience(sessionIds: string[]): Promise<SessionAudienceEntry[]>;
  enqueueReminders(rows: SessionReminderInsert[]): Promise<number>;
  claimReminders(
    nowIso: string,
    limit: number,
  ): Promise<SessionReminderClaim[]>;
  completeReminder(
    id: string,
    status: "sent" | "failed" | "skipped" | "pending",
    errorCategory: string | null,
    nextAttemptAt: string | null,
  ): Promise<boolean>;
  loadActiveSubscriptions(userIds: string[]): Promise<StoredSubscription[]>;
  markSubscriptionSuccess(subscriptionId: string, atIso: string): Promise<void>;
  disableSubscription(subscriptionId: string, atIso: string): Promise<void>;
}

export function createSupabaseSessionReminderStore(): SessionReminderStore {
  const supabase = createSupabaseAdminClient();

  return {
    async listCandidateSessions(nowIso, horizonIso) {
      const { data, error } = await supabase
        .from("discussion_sessions")
        .select("id, starts_at")
        .eq("status", "scheduled")
        .gt("starts_at", nowIso)
        .lte("starts_at", horizonIso)
        .order("starts_at", { ascending: true })
        .limit(MAX_CANDIDATES);

      if (error) {
        throw new PushStoreError(
          "Could not load candidate sessions",
          error.code,
        );
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        startsAt: row.starts_at,
      }));
    },

    async listAudience(sessionIds) {
      if (sessionIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase.rpc(
        "list_session_reminder_audience",
        { p_session_ids: sessionIds },
      );

      if (error) {
        throw new PushStoreError("Could not load session audience", error.code);
      }

      return (data ?? []).map((row) => ({
        sessionId: row.session_id,
        userId: row.user_id,
        timezone: row.pref_timezone,
        reminder24h: row.reminder_24h,
        reminder3h: row.reminder_3h,
      }));
    },

    async enqueueReminders(rows) {
      let inserted = 0;

      for (let index = 0; index < rows.length; index += INSERT_CHUNK_SIZE) {
        const chunk = rows.slice(index, index + INSERT_CHUNK_SIZE);
        const { error, count } = await supabase
          .from("discussion_session_reminders")
          // The unique key makes repeated runs idempotent, and a rescheduled
          // session produces a new logical reminder.
          .upsert(chunk, {
            onConflict: "user_id,session_id,reminder_type,starts_at",
            ignoreDuplicates: true,
            count: "exact",
          });

        if (error) {
          throw new PushStoreError(
            "Could not enqueue session reminders",
            error.code,
          );
        }

        inserted += count ?? 0;
      }

      return inserted;
    },

    async claimReminders(nowIso, limit) {
      const { data, error } = await supabase.rpc("claim_session_reminders", {
        p_now: nowIso,
        p_limit: limit,
      });

      if (error) {
        throw new PushStoreError(
          "Could not claim session reminders",
          error.code,
        );
      }

      return data ?? [];
    },

    async completeReminder(id, status, errorCategory, nextAttemptAt) {
      const { data, error } = await supabase.rpc("complete_session_reminder", {
        p_id: id,
        p_status: status,
        p_error_category: errorCategory,
        p_next_attempt_at: nextAttemptAt,
      });

      if (error) {
        throw new PushStoreError(
          "Could not record session reminder outcome",
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

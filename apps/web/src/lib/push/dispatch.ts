import "server-only";

import { getPushConfig } from "@/lib/push/config";
import { createSupabaseNotificationEventStore } from "@/lib/push/event-store";
import { runNotificationEvents } from "@/lib/push/event-scheduler";
import { createWebPushSender } from "@/lib/push/sender";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

/** Enough for a class-sized audience; the cron pass picks up anything left. */
const DISPATCH_BATCH_SIZE = 50;

/**
 * Delivers queued notifications right away instead of waiting for the ten-minute
 * cron pass, which is what an audience expects after a class post is published.
 *
 * Best effort by design: without VAPID keys or a service-role key there is
 * nothing to send with, and a delivery failure must never fail the request that
 * created the content. The cron pass remains the retry path.
 */
export async function dispatchNotificationEvents(): Promise<void> {
  const config = getPushConfig();

  if (!config || !isServiceRoleConfigured()) {
    return;
  }

  try {
    const summary = await runNotificationEvents({
      store: createSupabaseNotificationEventStore(),
      sender: createWebPushSender(config),
      limit: DISPATCH_BATCH_SIZE,
    });

    // Aggregate counters only; payloads are never logged.
    console.info("[push] immediate dispatch", summary);
  } catch (error) {
    console.error("[push] immediate dispatch failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
  }
}

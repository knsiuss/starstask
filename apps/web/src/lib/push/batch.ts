import "server-only";

import type {
  PushSender,
  PushSendOutcome,
  PushTarget,
} from "@/lib/push/sender";
import type { ReminderPayload } from "@/lib/push/payload";
import type { StoredSubscription } from "@/lib/push/store";

/**
 * Sends one push and converts a thrown sender into a transient failure.
 *
 * A thrown sender (DNS, socket reset) must not abort the whole batch, so it is
 * reported as retryable instead of propagating.
 */
export async function sendPushSafely(
  sender: PushSender,
  target: PushTarget,
  payload: ReminderPayload,
): Promise<PushSendOutcome> {
  try {
    return await sender.send(target, payload);
  } catch {
    return {
      ok: false,
      category: "transient",
      statusCode: null,
      retryable: true,
      disableSubscription: false,
    };
  }
}

export function groupSubscriptionsByUser(
  subscriptions: StoredSubscription[],
): Map<string, StoredSubscription[]> {
  const grouped = new Map<string, StoredSubscription[]>();

  for (const subscription of subscriptions) {
    const list = grouped.get(subscription.userId) ?? [];
    list.push(subscription);
    grouped.set(subscription.userId, list);
  }

  return grouped;
}

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Push/inbox notification for a DM message. The payload carries no
 * plaintext — only a generic body and the conversation path — because
 * message bodies are end-to-end encrypted. Uses the same row shape as
 * enqueue_notification_event (kind + dedupe_key + payload) so the
 * scheduler can deliver it like every other event.
 */
export async function notifyDmRecipient(
  conversationId: string,
  senderId: string,
  messageId: string,
) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: parts } = await supabase
    .from("dm_participants")
    .select("user_id, is_muted")
    .eq("conversation_id", conversationId)
    .neq("user_id", senderId)
    .is("left_at", null);
  // Muted conversations still receive the message, just no push/inbox ping.
  const recipients = (parts ?? [])
    .filter((p: any) => !p.is_muted)
    .map((p: any) => p.user_id);
  for (const userId of recipients) {
    await supabase.from("notification_events").insert({
      user_id: userId,
      kind: "dm_message",
      dedupe_key: `dm:${messageId}:${userId}`,
      payload: {
        title: "New message",
        body: "🔒 You have a new encrypted message",
        url: `/messages/${conversationId}`,
      },
    });
  }
}

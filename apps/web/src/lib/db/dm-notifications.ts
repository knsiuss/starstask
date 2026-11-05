import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Push notification trigger for DM: notify other participant (no plaintext in notif). */
export async function notifyDmRecipient(
  conversationId: string,
  senderId: string,
) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: parts } = await supabase
    .from("dm_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", senderId);
  const recipients = (parts ?? []).map((p: any) => p.user_id);
  for (const userId of recipients) {
    await supabase.from("notification_events").insert({
      user_id: userId,
      type: "dm_message",
      title: "New message",
      body: "🔒 You have a new encrypted message",
      data: { conversation_id: conversationId },
    });
  }
}

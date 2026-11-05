"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Supabase Realtime: postgres_changes for messages + presence for online/typing.
 * Channel per conversation. Falls back gracefully if Realtime disabled.
 */
export function subscribeConversation(
  conversationId: string,
  onMessage: () => void,
  onTyping: (typing: boolean) => void,
  onPresence: (online: boolean) => void,
) {
  const supabase = createSupabaseBrowserClient();
  const channel = supabase
    .channel(`dm:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "dm_messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      () => onMessage(),
    )
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      onPresence(Object.keys(state).length > 1);
    })
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "dm_typing",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: { new?: { is_typing?: boolean } }) => {
        onTyping(Boolean(payload.new?.is_typing));
      },
    )
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online: true, at: Date.now() });
      }
    });
  return () => {
    void supabase.removeChannel(channel);
  };
}

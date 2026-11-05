import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** DM v2 helpers: read receipts, edit/delete, reply, reactions, typing, group, safety. */

export async function markConversationRead(conversationId: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { error } = await supabase.rpc("dm_mark_read", {
    p_conversation: conversationId,
  });
  if (error) throw new DataAccessError("mark read failed", error.code);
}

export async function editMessage(messageId: string, ciphertext: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { error } = await supabase
    .from("dm_messages")
    .update({ body: ciphertext, edited_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) throw new DataAccessError("edit failed", error.code);
}

export async function deleteMessage(messageId: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { error } = await supabase
    .from("dm_messages")
    .update({ deleted_at: new Date().toISOString(), body: "" })
    .eq("id", messageId);
  if (error) throw new DataAccessError("delete failed", error.code);
}

/** Toggle (set/remove) the caller's emoji reaction on one message. */
export async function toggleReaction(
  messageId: string,
  conversationId: string,
  emoji: string,
): Promise<void> {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
  if (!me) throw new DataAccessError("Not signed in", "42501");

  const { data: msg, error: readError } = await supabase
    .from("dm_messages")
    .select("reactions")
    .eq("id", messageId)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (readError) throw new DataAccessError("reaction failed", readError.code);

  const reactions: Record<string, string> = { ...(msg?.reactions ?? {}) };
  if (reactions[me] === emoji) {
    delete reactions[me];
  } else {
    reactions[me] = emoji;
  }

  const { error } = await supabase
    .from("dm_messages")
    .update({ reactions })
    .eq("id", messageId);
  if (error) throw new DataAccessError("reaction failed", error.code);
}

export async function setTyping(conversationId: string, isTyping: boolean) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
  if (!me) return;
  await supabase.from("dm_typing").upsert(
    {
      conversation_id: conversationId,
      user_id: me,
      is_typing: isTyping,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" },
  );
}

export async function getTyping(conversationId: string): Promise<boolean> {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
  const since = new Date(Date.now() - 10000).toISOString();
  const { data } = await supabase
    .from("dm_typing")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("is_typing", true)
    .gte("updated_at", since)
    .neq("user_id", me ?? "");
  return (data?.length ?? 0) > 0;
}

export async function getSafetyFingerprint(
  peerPublicKey: string,
): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(peerPublicKey),
  );
  const hex = Buffer.from(hash).toString("hex").toUpperCase();
  return (
    hex
      .match(/.{1,4}/g)
      ?.join("-")
      .slice(0, 29) ?? hex.slice(0, 29)
  );
}

export async function createGroupConversation(
  name: string,
  otherUserIds: string[],
): Promise<string> {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
  if (!me) throw new DataAccessError("Not signed in", "42501");
  if (otherUserIds.length < 1)
    throw new DataAccessError("Need at least 1 other member", "22023");
  const { data: conv, error } = await supabase
    .from("dm_conversations")
    .insert({ is_group: true, group_name: name })
    .select("id")
    .single();
  if (error) throw new DataAccessError("create group failed", error.code);
  const members = [me, ...otherUserIds];
  const { error: pErr } = await supabase
    .from("dm_participants")
    .insert(members.map((user_id) => ({ conversation_id: conv.id, user_id })));
  if (pErr) throw new DataAccessError("add members failed", pErr.code);
  return conv.id as string;
}

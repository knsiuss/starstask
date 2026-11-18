import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import {
  createDmClient,
  isCiphertextWireFormat,
  MAX_CIPHERTEXT_LENGTH,
  toggleMessageReaction,
  type DmSupabaseClient,
} from "@/lib/db/direct-messages";

/** DM v2 helpers: read receipts, edit/delete, reply, reactions, typing, group, safety. */

export async function markConversationRead(conversationId: string) {
  const supabase = await createDmClient();
  const { error } = await supabase.rpc("dm_mark_read", {
    p_conversation: conversationId,
  });

  if (error) throw new DataAccessError("mark read failed", error.code);
}

async function requireOwnedMessage(
  messageId: string,
  conversationId: string,
): Promise<DmSupabaseClient> {
  const supabase = await createDmClient();
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;

  if (!me) throw new DataAccessError("Not signed in", "42501");

  const { data: msg, error } = await supabase
    .from("dm_messages")
    .select("sender_id")
    .eq("id", messageId)
    .eq("conversation_id", conversationId)
    .maybeSingle<{ sender_id: string }>();

  if (error) throw new DataAccessError("edit failed", error.code);
  if (!msg) throw new DataAccessError("Message not found", "PGRST116");
  if (msg.sender_id !== me) {
    throw new DataAccessError("Only the sender can edit this", "42501");
  }

  return supabase;
}

export async function editMessage(
  messageId: string,
  conversationId: string,
  ciphertext: string,
) {
  if (
    !isCiphertextWireFormat(ciphertext) ||
    ciphertext.length > MAX_CIPHERTEXT_LENGTH
  ) {
    throw new DataAccessError("Message must be encrypted", "22023");
  }

  const supabase = await requireOwnedMessage(messageId, conversationId);
  const { error } = await supabase
    .from("dm_messages")
    .update({ body: ciphertext, edited_at: new Date().toISOString() })
    .eq("id", messageId);

  if (error) throw new DataAccessError("edit failed", error.code);
}

export async function deleteMessage(messageId: string, conversationId: string) {
  const supabase = await requireOwnedMessage(messageId, conversationId);
  // Soft delete only: blanking body would violate the length check and
  // listMessages already filters deleted_at IS NULL.
  const { error } = await supabase
    .from("dm_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);

  if (error) throw new DataAccessError("delete failed", error.code);
}

export async function setConversationPrefs(
  conversationId: string,
  prefs: { pinned?: boolean; muted?: boolean; archived?: boolean },
) {
  const supabase = await createDmClient();
  const { error } = await supabase.rpc("dm_set_conversation_pref", {
    p_conversation: conversationId,
    p_pinned: prefs.pinned ?? null,
    p_muted: prefs.muted ?? null,
    p_archived: prefs.archived ?? null,
  });

  if (error) throw new DataAccessError("pref failed", error.code);
}

export async function markConversationUnread(conversationId: string) {
  const supabase = await createDmClient();
  const { error } = await supabase.rpc("dm_mark_unread", {
    p_conversation: conversationId,
  });

  if (error) throw new DataAccessError("mark unread failed", error.code);
}

export async function setMessagePinned(
  messageId: string,
  conversationId: string,
  pinned: boolean,
) {
  const supabase = await createDmClient();
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;

  if (!me) throw new DataAccessError("Not signed in", "42501");

  const { data: part } = await supabase
    .from("dm_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", me)
    .is("left_at", null)
    .maybeSingle<{ user_id: string }>();

  if (!part) throw new DataAccessError("Not a participant", "42501");

  const { error } = await supabase
    .from("dm_messages")
    .update({ is_pinned: pinned })
    .eq("id", messageId)
    .eq("conversation_id", conversationId);

  if (error) throw new DataAccessError("pin failed", error.code);
}

/** Toggle (set/remove) the caller's emoji reaction on one message via RPC. */
export async function toggleReaction(
  messageId: string,
  _conversationId: string,
  emoji: string,
): Promise<Record<string, string>> {
  return toggleMessageReaction(messageId, emoji);
}

export async function setTyping(conversationId: string, isTyping: boolean) {
  const supabase = await createDmClient();
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;

  if (!me) {
    throw new DataAccessError("Not signed in", "42501");
  }

  const { error } = await supabase.from("dm_typing").upsert(
    {
      conversation_id: conversationId,
      user_id: me,
      is_typing: isTyping,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" },
  );

  if (error) throw new DataAccessError("typing failed", error.code);
}

export async function getTyping(conversationId: string): Promise<boolean> {
  const supabase = await createDmClient();
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;

  if (!me) {
    throw new DataAccessError("Not signed in", "42501");
  }

  const since = new Date(Date.now() - 10000).toISOString();
  const { data, error } = await supabase
    .from("dm_typing")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("is_typing", true)
    .gte("updated_at", since)
    .neq("user_id", me);

  if (error) throw new DataAccessError("typing failed", error.code);

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
  const supabase = await createDmClient();
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;

  if (!me) throw new DataAccessError("Not signed in", "42501");
  if (otherUserIds.length < 1) {
    throw new DataAccessError("Need at least 1 other member", "22023");
  }

  const { data, error } = await supabase.rpc<string>(
    "create_group_dm_conversation",
    {
      p_title: name,
      p_member_ids: otherUserIds,
    },
  );

  if (error || !data) {
    throw new DataAccessError("create group failed", error?.code);
  }

  return data;
}

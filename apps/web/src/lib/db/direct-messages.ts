import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// DM tables are new (not yet in hand-written Database types) — untyped client for DM only.
async function dmClient() {
  const client = await createSupabaseServerClient();
  return client as unknown as {
    from: (table: string) => never;
    rpc: (
      fn: string,
      args?: unknown,
    ) => Promise<{ data: unknown; error: { code?: string } | null }>;
    auth: {
      getUser: () => Promise<{ data: { user?: { id: string } | null } }>;
    };
  };
}

export const ENCRYPTED_PREVIEW = "🔒 Encrypted";

const MAX_CIPHERTEXT_LENGTH = 8000;
const MAX_PLAINTEXT_LENGTH = 2000;
const RATE_LIMIT_PER_MINUTE = 5;
const RATE_WINDOW_MS = 60000;

/** Wire format check: base64(iv) + ":" + base64(ciphertext). */
export function isCiphertextWireFormat(wire: string): boolean {
  const parts = wire.split(":");

  if (parts.length !== 2) {
    return false;
  }

  const [ivPart, cipherPart] = parts;

  return (
    typeof ivPart === "string" &&
    typeof cipherPart === "string" &&
    ivPart.length > 0 &&
    cipherPart.length > 0 &&
    !cipherPart.includes(":")
  );
}

export type ConversationRow = {
  id: string;
  otherUserId: string;
  otherName: string;
  otherAvatarUrl: string | null;
  isGroup: boolean;
  participantNames: string[];
  lastMessage: typeof ENCRYPTED_PREVIEW | null;
  lastAt: string | null;
  unread: boolean;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
};

export type StoredMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  reply_to_id: string | null;
  reactions: Record<string, string>;
  is_pinned: boolean;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  attachment_path: string | null;
};

async function requireUserId(): Promise<string> {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;

  if (!me) {
    throw new DataAccessError("Not signed in", "42501");
  }

  return me;
}

/**
 * One-roundtrip conversation list via `list_dm_conversations` RPC.
 * Falls back to the multi-query logic below when the function is not
 * deployed yet (rollout safety: the RPC is additive, old reads keep working).
 */
export async function listConversations(): Promise<ConversationRow[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data, error } = await supabase.rpc("list_dm_conversations");

  if (error || !data) {
    return listConversationsViaQueries();
  }

  return (data as any[]).map((row) => ({
    id: row.id,
    otherUserId: row.other_user_id ?? "",
    otherName: row.other_name ?? "User",
    otherAvatarUrl: row.other_avatar_url ?? null,
    isGroup: Boolean(row.is_group),
    participantNames: (row.participant_names ?? []).map(String),
    // Server cannot decrypt; never expose ciphertext as preview.
    lastMessage: row.last_message ?? null,
    lastAt: row.last_at ?? null,
    unread: Boolean(row.unread),
    unreadCount: Number(row.unread_count ?? 0),
    isPinned: Boolean(row.is_pinned),
    isMuted: Boolean(row.is_muted),
    isArchived: Boolean(row.is_archived),
  }));
}

async function listConversationsViaQueries(): Promise<ConversationRow[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const me = await requireUserId();
  const { data: myParts } = await supabase
    .from("dm_participants")
    .select(
      "conversation_id, last_read_at, is_pinned, is_muted, is_archived, pinned_at",
    )
    .eq("user_id", me)
    .is("left_at", null);
  const ids: string[] = (myParts ?? []).map(
    (part: any) => part.conversation_id,
  );

  if (ids.length === 0) {
    return [];
  }

  const { data: allParts } = await supabase
    .from("dm_participants")
    .select("conversation_id, user_id")
    .in("conversation_id", ids);
  const { data: messages } = await supabase
    .from("dm_messages")
    .select("conversation_id, created_at, sender_id")
    .in("conversation_id", ids)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const otherIds = [
    ...new Set(
      (allParts ?? [])
        .map((part: any) => part.user_id)
        .filter((userId: any) => userId !== me),
    ),
  ];
  const { data: profiles } = otherIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", otherIds)
    : { data: [] };
  const nameById = new Map<string, string>(
    (profiles ?? []).map((profile: any) => [
      String(profile.id),
      String(profile.display_name ?? "User"),
    ]),
  );
  const avatarById = new Map<string, string | null>(
    (profiles ?? []).map((profile: any) => [
      String(profile.id),
      (profile.avatar_url as string | null) ?? null,
    ]),
  );
  const readAtByConversation = new Map<string, string | null>(
    (myParts ?? []).map((part: any) => [
      part.conversation_id,
      part.last_read_at,
    ]),
  );
  const prefByConversation = new Map<
    string,
    {
      pinned: boolean;
      muted: boolean;
      archived: boolean;
      pinnedAt: string | null;
    }
  >(
    (myParts ?? []).map((part: any) => [
      part.conversation_id,
      {
        pinned: Boolean(part.is_pinned),
        muted: Boolean(part.is_muted),
        archived: Boolean(part.is_archived),
        pinnedAt: part.pinned_at ?? null,
      },
    ]),
  );
  const lastByConversation = new Map<string, { at: string; sender: string }>();
  const unreadByConversation = new Map<string, number>();

  for (const message of messages ?? []) {
    if (!lastByConversation.has(message.conversation_id)) {
      lastByConversation.set(message.conversation_id, {
        at: message.created_at,
        sender: message.sender_id,
      });
    }

    if (message.sender_id !== me) {
      const readAt = readAtByConversation.get(message.conversation_id) ?? null;
      if (!readAt || message.created_at > readAt) {
        unreadByConversation.set(
          message.conversation_id,
          (unreadByConversation.get(message.conversation_id) ?? 0) + 1,
        );
      }
    }
  }

  const participantsByConversation = new Map<string, string[]>();

  for (const part of allParts ?? []) {
    if (part.user_id === me) continue;
    const list = participantsByConversation.get(part.conversation_id) ?? [];
    list.push(part.user_id);
    participantsByConversation.set(part.conversation_id, list);
  }

  const rows: ConversationRow[] = ids.map((id) => {
    const participantIds = participantsByConversation.get(id) ?? [];
    const other = participantIds[0] ?? "";
    const last = lastByConversation.get(id);
    const isGroup = participantIds.length > 1;
    const prefs = prefByConversation.get(id) ?? {
      pinned: false,
      muted: false,
      archived: false,
      pinnedAt: null,
    };
    const unreadCount = unreadByConversation.get(id) ?? 0;

    return {
      id,
      otherUserId: other,
      otherName: isGroup
        ? `${participantIds.length} members`
        : (nameById.get(other) ?? "User"),
      otherAvatarUrl: avatarById.get(other) ?? null,
      isGroup,
      participantNames: participantIds.map(
        (userId: string) => nameById.get(userId) ?? "User",
      ),
      // Server cannot decrypt; never expose ciphertext as preview.
      lastMessage: last ? ENCRYPTED_PREVIEW : null,
      lastAt: last?.at ?? null,
      unread: unreadCount > 0,
      unreadCount,
      isPinned: prefs.pinned,
      isMuted: prefs.muted,
      isArchived: prefs.archived,
    };
  });

  // Running feed: pinned first (most-recently pinned first), then newest
  // activity. Archived rows stay for the Archived tab, sorted last.
  return rows.sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return (b.lastAt ?? "").localeCompare(a.lastAt ?? "");
  });
}

export async function listMessages(
  conversationId: string,
  options?: { before?: string; limit?: number },
): Promise<StoredMessage[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  let query = supabase
    .from("dm_messages")
    .select(
      "id, sender_id, body, created_at, edited_at, reply_to_id, reactions, is_pinned, attachment_name, attachment_mime, attachment_size, attachment_path",
    )
    .eq("conversation_id", conversationId)
    .is("deleted_at", null);

  if (options?.before) {
    query = query.lt("created_at", options.before);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataAccessError("Could not load messages", error.code);
  }

  return ((data ?? []) as StoredMessage[]).reverse();
}

export async function getConversationPeerId(
  conversationId: string,
): Promise<string> {
  const supabase = (await createSupabaseServerClient()) as any;
  const me = await requireUserId();
  const { data, error } = await supabase
    .from("dm_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", me)
    .is("left_at", null)
    .limit(1);

  if (error || !data?.[0]) {
    throw new DataAccessError("Could not load conversation", error?.code);
  }

  return data[0].user_id;
}

export async function getConversationParticipants(
  conversationId: string,
): Promise<{ userId: string; name: string; avatarUrl: string | null }[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const me = await requireUserId();
  const { data: parts } = await supabase
    .from("dm_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .is("left_at", null);
  const userIds: string[] = (parts ?? [])
    .map((part: any) => part.user_id)
    .filter((userId: string) => userId !== me);

  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);

  const nameById = new Map<string, string>(
    (profiles ?? []).map((profile: any) => [
      String(profile.id),
      String(profile.display_name ?? "User"),
    ]),
  );
  const avatarById = new Map<string, string | null>(
    (profiles ?? []).map((profile: any) => [
      String(profile.id),
      profile.avatar_url ?? null,
    ]),
  );

  return userIds.map((userId) => ({
    userId,
    name: nameById.get(userId) ?? "User",
    avatarUrl: avatarById.get(userId) ?? null,
  }));
}

export async function getPeerPublicKey(
  otherUserId: string,
): Promise<string | null> {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data } = await supabase
    .from("dm_keys")
    .select("public_key")
    .eq("user_id", otherUserId)
    .single();

  return data?.public_key ?? null;
}

export async function upsertOwnPublicKey(publicKey: string): Promise<void> {
  const me = await requireUserId();
  const supabase = (await createSupabaseServerClient()) as any;
  const { error } = await supabase.from("dm_keys").upsert(
    {
      user_id: me,
      public_key: publicKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new DataAccessError("Could not save key", error.code);
  }
}

export async function getOwnPublicKey(): Promise<string | null> {
  const me = await requireUserId();
  const supabase = (await createSupabaseServerClient()) as any;
  const { data } = await supabase
    .from("dm_keys")
    .select("public_key")
    .eq("user_id", me)
    .single();

  return data?.public_key ?? null;
}

/**
 * Stores ciphertext only. Plaintext length is enforced client-side
 * before encryption; the server validates the wire format and size.
 */
export async function sendCiphertext(
  conversationId: string,
  ciphertext: string,
  attachment?: {
    name: string;
    mime: string;
    size: number;
    path: string;
  },
): Promise<{ id: string }> {
  if (!isCiphertextWireFormat(ciphertext)) {
    throw new DataAccessError("Message must be encrypted", "22023");
  }

  if (ciphertext.length === 0 || ciphertext.length > MAX_CIPHERTEXT_LENGTH) {
    throw new DataAccessError(
      "Message too long (max 2000 characters)",
      "22023",
    );
  }

  const supabase = (await createSupabaseServerClient()) as any;
  const me = await requireUserId();
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("dm_messages")
    .select("*", { count: "exact", head: true })
    .eq("sender_id", me)
    .gte("created_at", since);

  if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    throw new DataAccessError("Too many messages, slow down", "42901");
  }

  const { data: message, error } = await supabase
    .from("dm_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: me,
      body: ciphertext,
      attachment_name: attachment?.name ?? null,
      attachment_mime: attachment?.mime ?? null,
      attachment_size: attachment?.size ?? null,
      attachment_path: attachment?.path ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new DataAccessError("Could not send message", error.code);
  }

  // Push notif (fire-and-forget, no plaintext)
  import("@/lib/db/dm-notifications")
    .then((m) => m.notifyDmRecipient(conversationId, me, message.id))
    .catch(() => {});

  return message as { id: string };
}

/** @deprecated Plaintext path removed; use sendCiphertext. */
export async function sendMessage(
  _conversationId: string,
  _body: string,
): Promise<never> {
  throw new DataAccessError(
    "Plaintext sending is disabled (E2EE required)",
    "22023",
  );
}

export async function getOrCreateConversation(
  otherUserId: string,
): Promise<string> {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data, error } = await supabase.rpc("dm_get_or_create_conversation", {
    p_other: otherUserId,
  });

  if (error || !data) {
    throw new DataAccessError("Could not open chat (blocked?)", error?.code);
  }

  return data as string;
}

export async function blockUser(blockedId: string): Promise<void> {
  const me = await requireUserId();
  const supabase = (await createSupabaseServerClient()) as any;
  const { error } = await supabase
    .from("dm_blocks")
    .insert({ blocker_id: me, blocked_id: blockedId });

  if (error) {
    throw new DataAccessError("Could not block", error.code);
  }
}

export async function searchUsers(
  query: string,
): Promise<{ id: string; display_name: string; avatar_url: string | null }[]> {
  const normalized = query.trim().slice(0, MAX_PLAINTEXT_LENGTH);

  // Discovery is display-name only: never expose email, NIM, or the full
  // directory. Minimum length avoids directory enumeration.
  if (normalized.length < 2) {
    return [];
  }

  const supabase = (await createSupabaseServerClient()) as any;
  const me = await requireUserId();
  // Escape LIKE wildcards so user input matches literally.
  const escaped = normalized.replace(/[%_\\]/g, "\\$&");
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .ilike("display_name", `%${escaped}%`)
    .neq("id", me)
    .limit(10);

  return data ?? [];
}

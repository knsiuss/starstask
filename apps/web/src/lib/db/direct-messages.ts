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
  isGroup: boolean;
  participantNames: string[];
  lastMessage: typeof ENCRYPTED_PREVIEW | null;
  lastAt: string | null;
  unread: boolean;
};

export type StoredMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
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

export async function listConversations(): Promise<ConversationRow[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const me = await requireUserId();
  const { data: parts } = await supabase
    .from("dm_participants")
    .select("conversation_id")
    .eq("user_id", me)
    .is("left_at", null);
  const ids = (parts ?? []).map((part: any) => part.conversation_id);

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
        .select("id, display_name")
        .in("id", otherIds)
    : { data: [] };
  const nameById = new Map(
    (profiles ?? []).map((profile: any) => [profile.id, profile.display_name]),
  );
  const lastByConversation = new Map<string, { at: string; sender: string }>();

  for (const message of messages ?? []) {
    if (!lastByConversation.has(message.conversation_id)) {
      lastByConversation.set(message.conversation_id, {
        at: message.created_at,
        sender: message.sender_id,
      });
    }
  }

  const otherByConversation = new Map<string, string>();

  for (const part of allParts ?? []) {
    if (part.user_id !== me) {
      otherByConversation.set(part.conversation_id, part.user_id);
    }
  }

  const participantsByConversation = new Map<string, string[]>();

  for (const part of allParts ?? []) {
    if (part.user_id === me) continue;
    const list = participantsByConversation.get(part.conversation_id) ?? [];
    list.push(part.user_id);
    participantsByConversation.set(part.conversation_id, list);
  }

  return ids.map((id: any) => {
    const participantIds = participantsByConversation.get(id) ?? [];
    const other = participantIds[0] ?? "";
    const last = lastByConversation.get(id);
    const isGroup = participantIds.length > 1;

    return {
      id,
      otherUserId: other,
      otherName: isGroup
        ? `${participantIds.length} members`
        : (nameById.get(other) ?? "User"),
      isGroup,
      participantNames: participantIds.map(
        (userId: string) => nameById.get(userId) ?? "User",
      ),
      // Server cannot decrypt; never expose ciphertext as preview.
      lastMessage: last ? ENCRYPTED_PREVIEW : null,
      lastAt: last?.at ?? null,
      unread: Boolean(last && last.sender !== me),
    };
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
      "id, sender_id, body, created_at, attachment_name, attachment_mime, attachment_size, attachment_path",
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
): Promise<{ userId: string; name: string }[]> {
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
    .select("id, display_name")
    .in("id", userIds);

  const nameById = new Map<string, string>(
    (profiles ?? []).map((profile: any) => [
      String(profile.id),
      String(profile.display_name ?? "User"),
    ]),
  );

  return userIds.map((userId) => ({
    userId,
    name: nameById.get(userId) ?? "User",
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
): Promise<{ id: string; display_name: string }[]> {
  const normalized = query.trim().slice(0, MAX_PLAINTEXT_LENGTH);

  if (!normalized) {
    return [];
  }

  const supabase = (await createSupabaseServerClient()) as any;
  const me = await requireUserId();
  // Escape LIKE wildcards so user input matches literally.
  const escaped = normalized.replace(/[%_\\]/g, "\\$&");
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .ilike("display_name", `%${escaped}%`)
    .neq("id", me)
    .limit(10);

  return data ?? [];
}

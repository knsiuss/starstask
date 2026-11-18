import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DbError = { code?: string; message?: string } | null;

type QueryResult<T> = Promise<{
  data: T | null;
  error: DbError;
  count?: number | null;
}>;

export interface DmFilterBuilder<T = Array<Record<string, unknown>>> {
  eq: (column: string, value: unknown) => DmFilterBuilder<T>;
  neq: (column: string, value: unknown) => DmFilterBuilder<T>;
  in: (column: string, values: readonly unknown[]) => DmFilterBuilder<T>;
  is: (column: string, value: null) => DmFilterBuilder<T>;
  gte: (column: string, value: unknown) => DmFilterBuilder<T>;
  lt: (column: string, value: unknown) => DmFilterBuilder<T>;
  ilike: (column: string, pattern: string) => DmFilterBuilder<T>;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => DmFilterBuilder<T>;
  limit: (count: number) => DmFilterBuilder<T>;
  select: (columns?: string) => DmFilterBuilder<T>;
  maybeSingle: <R = Record<string, unknown>>() => QueryResult<R>;
  single: <R = Record<string, unknown>>() => QueryResult<R>;
  then: QueryResult<T>["then"];
}

export interface DmTableClient {
  select: (
    columns?: string,
    options?: { count?: "exact"; head?: boolean },
  ) => DmFilterBuilder;
  insert: (values: unknown) => DmFilterBuilder;
  update: (values: unknown) => DmFilterBuilder;
  upsert: (
    values: unknown,
    options?: { onConflict?: string },
  ) => DmFilterBuilder;
}

export interface DmSupabaseClient {
  from: (table: string) => DmTableClient;
  rpc: <T = unknown>(
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: T | null; error: DbError }>;
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>;
  };
}

export async function createDmClient(): Promise<DmSupabaseClient> {
  const client = await createSupabaseServerClient();

  return client as unknown as DmSupabaseClient;
}

export const ENCRYPTED_PREVIEW = "🔒 Encrypted";

export const MAX_CIPHERTEXT_LENGTH = 32000;
const MAX_PLAINTEXT_LENGTH = 2000;
const RATE_LIMIT_PER_MINUTE = 5;
const RATE_WINDOW_MS = 60000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Wire format check:
 * - `iv:ciphertext` (v1)
 * - `v2:iv:ciphertext` (v2 AAD-bound)
 * - `v2:{...}` (v2 multi-device JSON envelope: `v === 2` + non-empty `envelopes`)
 * - `v2g:{...}` (v2 group sender-key JSON envelope: `v === 2` + non-empty `keyId`, `iv`, `ct`/`ciphertext`)
 */
export function isCiphertextWireFormat(wire: string): boolean {
  if (wire.startsWith("v2g:")) {
    try {
      const parsed: unknown = JSON.parse(wire.slice(4));

      if (!isPlainObject(parsed) || parsed.v !== 2) {
        return false;
      }

      const cipherField =
        typeof parsed.ct === "string" ? parsed.ct : parsed.ciphertext;

      return (
        typeof parsed.keyId === "string" &&
        parsed.keyId.length > 0 &&
        typeof parsed.iv === "string" &&
        parsed.iv.length > 0 &&
        typeof cipherField === "string" &&
        cipherField.length > 0
      );
    } catch {
      return false;
    }
  }

  if (wire.startsWith("v2:{")) {
    try {
      const parsed: unknown = JSON.parse(wire.slice(3));

      if (!isPlainObject(parsed) || parsed.v !== 2) {
        return false;
      }

      return (
        isPlainObject(parsed.envelopes) &&
        Object.keys(parsed.envelopes).length > 0
      );
    } catch {
      return false;
    }
  }

  const parts = wire.split(":");
  const rest = parts[0] === "v2" ? parts.slice(1) : parts;

  if (rest.length !== 2) {
    return false;
  }

  const [ivPart, cipherPart] = rest;

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

type RpcConversationRow = {
  id: string;
  other_user_id: string | null;
  other_name: string | null;
  other_avatar_url: string | null;
  is_group: boolean | null;
  participant_names: string[] | null;
  last_message: typeof ENCRYPTED_PREVIEW | null;
  last_at: string | null;
  unread: boolean | null;
  unread_count: number | null;
  is_pinned: boolean | null;
  is_muted: boolean | null;
  is_archived: boolean | null;
};

type MyParticipantRow = {
  conversation_id: string;
  last_read_at: string | null;
  is_pinned: boolean | null;
  is_muted: boolean | null;
  is_archived: boolean | null;
  pinned_at: string | null;
};

type ParticipantUserRow = {
  conversation_id: string;
  user_id: string;
};

type MessageSummaryRow = {
  conversation_id: string;
  created_at: string;
  sender_id: string;
};

type ProfileSummaryRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

async function requireUserId(): Promise<string> {
  const supabase = await createDmClient();
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
  const supabase = await createDmClient();
  const { data, error } = await supabase.rpc<RpcConversationRow[]>(
    "list_dm_conversations",
  );

  if (error || !data) {
    return listConversationsViaQueries();
  }

  return data.map((row) => ({
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
  const supabase = await createDmClient();
  const me = await requireUserId();
  const { data: myPartsRaw } = await supabase
    .from("dm_participants")
    .select(
      "conversation_id, last_read_at, is_pinned, is_muted, is_archived, pinned_at",
    )
    .eq("user_id", me)
    .is("left_at", null);
  const myParts = (myPartsRaw ?? []) as MyParticipantRow[];
  const ids: string[] = myParts.map((part) => part.conversation_id);

  if (ids.length === 0) {
    return [];
  }

  const { data: allPartsRaw } = await supabase
    .from("dm_participants")
    .select("conversation_id, user_id")
    .in("conversation_id", ids);
  const allParts = (allPartsRaw ?? []) as ParticipantUserRow[];
  const { data: messagesRaw } = await supabase
    .from("dm_messages")
    .select("conversation_id, created_at, sender_id")
    .in("conversation_id", ids)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const messages = (messagesRaw ?? []) as MessageSummaryRow[];
  const otherIds = [
    ...new Set(
      allParts.map((part) => part.user_id).filter((userId) => userId !== me),
    ),
  ];
  const { data: profilesRaw } = otherIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", otherIds)
    : { data: [] };
  const profiles = (profilesRaw ?? []) as ProfileSummaryRow[];
  const nameById = new Map<string, string>(
    profiles.map((profile) => [
      String(profile.id),
      String(profile.display_name ?? "User"),
    ]),
  );
  const avatarById = new Map<string, string | null>(
    profiles.map((profile) => [String(profile.id), profile.avatar_url ?? null]),
  );
  const readAtByConversation = new Map<string, string | null>(
    myParts.map((part) => [part.conversation_id, part.last_read_at]),
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
    myParts.map((part) => [
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

  for (const message of messages) {
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

  for (const part of allParts) {
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
  const supabase = await createDmClient();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  let query = supabase
    .from("dm_messages")
    .select(
      "id, sender_id, body, created_at, edited_at, reply_to_id, reactions, is_pinned, attachment_name, attachment_mime, attachment_size, attachment_path, group_wraps",
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

  return ((data ?? []) as unknown as StoredMessage[]).reverse();
}

/** Public keys of every active participant (for group per-recipient envelopes). */
export async function getConversationMemberKeys(
  conversationId: string,
): Promise<Record<string, string>> {
  const supabase = await createDmClient();
  const me = await requireUserId();
  const { data: partsRaw } = await supabase
    .from("dm_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .is("left_at", null);

  const userIds: string[] = ((partsRaw ?? []) as Array<{ user_id: string }>)
    .map((part) => part.user_id)
    .filter((userId) => userId !== me);

  if (userIds.length === 0) return {};

  const { data: keysRaw } = await supabase
    .from("dm_keys")
    .select("user_id, public_key")
    .in("user_id", [...userIds, me]);

  const out: Record<string, string> = {};

  for (const row of (keysRaw ?? []) as Array<{
    user_id: string;
    public_key: string | null;
  }>) {
    if (row.public_key) out[String(row.user_id)] = String(row.public_key);
  }

  return out;
}

export async function getConversationPeerId(
  conversationId: string,
): Promise<string | null> {
  const supabase = await createDmClient();
  const me = await requireUserId();

  const { data: membership, error: memberError } = await supabase
    .from("dm_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", me)
    .is("left_at", null)
    .maybeSingle<{ user_id: string }>();

  if (memberError) {
    throw new DataAccessError("Could not load conversation", memberError.code);
  }

  if (!membership) {
    throw new DataAccessError(
      "You are not a participant in this conversation",
      "42501",
    );
  }

  const { data: conv, error: convError } = await supabase
    .from("dm_conversations")
    .select("is_group")
    .eq("id", conversationId)
    .maybeSingle<{ is_group: boolean | null }>();

  if (convError) {
    throw new DataAccessError("Could not load conversation", convError.code);
  }

  if (!conv) {
    throw new DataAccessError("Conversation not found", "PGRST116");
  }

  if (conv.is_group) {
    return null;
  }

  const { data: peerRows, error: peerError } = await supabase
    .from("dm_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", me)
    .is("left_at", null)
    .limit(1);

  if (peerError) {
    throw new DataAccessError("Could not load conversation", peerError.code);
  }

  const rows = (peerRows ?? []) as Array<{ user_id: string }>;

  return rows[0]?.user_id ?? null;
}

/**
 * Resolves the target user ID for `/api/dm/conversations/[id]/block`.
 *
 * Rejects group conversations without an explicit target `userId`, and looks up
 * 1:1 peers regardless of `left_at` so a user can still block a peer who left.
 */
export async function resolveBlockTargetInConversation(
  conversationId: string,
  requestedUserId?: string,
): Promise<string> {
  const supabase = await createDmClient();
  const me = await requireUserId();

  const { data: membership, error: memberError } = await supabase
    .from("dm_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", me)
    .is("left_at", null)
    .maybeSingle<{ user_id: string }>();

  if (memberError) {
    throw new DataAccessError("Could not load conversation", memberError.code);
  }

  if (!membership) {
    throw new DataAccessError(
      "You are not a participant in this conversation",
      "42501",
    );
  }

  const { data: conv, error: convError } = await supabase
    .from("dm_conversations")
    .select("is_group")
    .eq("id", conversationId)
    .maybeSingle<{ is_group: boolean | null }>();

  if (convError) {
    throw new DataAccessError("Could not load conversation", convError.code);
  }

  if (!conv) {
    throw new DataAccessError("Conversation not found", "PGRST116");
  }

  if (conv.is_group) {
    if (!requestedUserId) {
      throw new DataAccessError(
        "Specify a user to block in group conversations",
        "22023",
      );
    }

    if (requestedUserId === me) {
      throw new DataAccessError("Cannot block yourself", "22023");
    }

    const { data: targetMember, error: targetError } = await supabase
      .from("dm_participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", requestedUserId)
      .maybeSingle<{ user_id: string }>();

    if (targetError) {
      throw new DataAccessError(
        "Could not load conversation",
        targetError.code,
      );
    }

    if (!targetMember) {
      throw new DataAccessError(
        "Target user is not in this conversation",
        "22023",
      );
    }

    return requestedUserId;
  }

  const { data: peerRows, error: peerError } = await supabase
    .from("dm_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", me)
    .limit(1);

  if (peerError) {
    throw new DataAccessError("Could not load conversation", peerError.code);
  }

  const peerId = (peerRows as Array<{ user_id: string }> | null)?.[0]?.user_id;

  if (!peerId) {
    throw new DataAccessError("Conversation peer not found", "PGRST116");
  }

  if (requestedUserId && requestedUserId !== peerId) {
    throw new DataAccessError(
      "Target user is not the peer in this conversation",
      "22023",
    );
  }

  return peerId;
}

export async function getConversationParticipants(
  conversationId: string,
): Promise<{ userId: string; name: string; avatarUrl: string | null }[]> {
  const supabase = await createDmClient();
  const me = await requireUserId();
  const { data: partsRaw } = await supabase
    .from("dm_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .is("left_at", null);
  const userIds: string[] = ((partsRaw ?? []) as Array<{ user_id: string }>)
    .map((part) => part.user_id)
    .filter((userId) => userId !== me);

  if (userIds.length === 0) return [];

  const { data: profilesRaw } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);
  const profiles = (profilesRaw ?? []) as ProfileSummaryRow[];

  const nameById = new Map<string, string>(
    profiles.map((profile) => [
      String(profile.id),
      String(profile.display_name ?? "User"),
    ]),
  );
  const avatarById = new Map<string, string | null>(
    profiles.map((profile) => [String(profile.id), profile.avatar_url ?? null]),
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
  const supabase = await createDmClient();
  const { data } = await supabase
    .from("dm_keys")
    .select("public_key")
    .eq("user_id", otherUserId)
    .single<{ public_key: string | null }>();

  return data?.public_key ?? null;
}

export async function upsertOwnPublicKey(publicKey: string): Promise<void> {
  // P-256 uncompressed points are 65 bytes: 0x04 || X(32) || Y(32).
  // Anything else cannot be a key our clients would have generated, and
  // accepting it would hand the server's MITM ability a valid-looking key.
  if (
    !/^[A-Za-z0-9+/=]+$/.test(publicKey) ||
    base64Length(publicKey) !== 65 ||
    base64FirstByte(publicKey) !== 0x04
  ) {
    throw new DataAccessError("Invalid public key", "22023");
  }

  const me = await requireUserId();
  const supabase = await createDmClient();

  // Key history: if the key changed, retain the old key before overwriting so
  // peers can detect the change (they pin fingerprints client-side).
  const { data: previous } = await supabase
    .from("dm_keys")
    .select("public_key")
    .eq("user_id", me)
    .maybeSingle<{ public_key?: string }>();

  const previousKey = previous?.public_key;

  if (previousKey && previousKey !== publicKey) {
    await supabase.from("dm_key_history").insert({
      user_id: me,
      public_key: previousKey,
    });
  }

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

function base64Length(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

function base64FirstByte(value: string): number {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64")[0] ?? 0;
}

export async function getOwnPublicKey(): Promise<string | null> {
  const me = await requireUserId();
  const supabase = await createDmClient();
  const { data } = await supabase
    .from("dm_keys")
    .select("public_key")
    .eq("user_id", me)
    .single<{ public_key: string | null }>();

  return data?.public_key ?? null;
}

/**
 * Stores ciphertext only. Plaintext length is enforced client-side
 * before encryption; the server validates the wire format and size.
 * Group messages also carry per-recipient key envelopes (`groupWraps`) the
 * server stores opaquely — it can never unwrap them.
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
  groupWraps?: Record<string, { iv: string; cipher: string }>,
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

  const supabase = await createDmClient();
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
      group_wraps: groupWraps ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !message) {
    throw new DataAccessError("Could not send message", error?.code);
  }

  // Push notif (fire-and-forget, no plaintext)
  import("@/lib/db/dm-notifications")
    .then((m) => m.notifyDmRecipient(conversationId, me, message.id))
    .catch(() => {});

  return message;
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

/** Toggles the caller's emoji reaction via the `toggle_dm_message_reaction` RPC. */
export async function toggleMessageReaction(
  messageId: string,
  emoji: string,
): Promise<Record<string, string>> {
  await requireUserId();
  const supabase = await createDmClient();
  const { data, error } = await supabase.rpc<Record<string, string>>(
    "toggle_dm_message_reaction",
    {
      p_message_id: messageId,
      p_emoji: emoji,
    },
  );

  if (error) {
    throw new DataAccessError("reaction failed", error.code);
  }

  return data ?? {};
}

export async function getOrCreateConversation(
  otherUserId: string,
): Promise<string> {
  const supabase = await createDmClient();
  const { data, error } = await supabase.rpc<string>(
    "dm_get_or_create_conversation",
    {
      p_other: otherUserId,
    },
  );

  if (error || !data) {
    throw new DataAccessError("Could not open chat (blocked?)", error?.code);
  }

  return data;
}

export async function blockUser(blockedId: string): Promise<void> {
  const me = await requireUserId();
  const supabase = await createDmClient();
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

  const supabase = await createDmClient();
  const me = await requireUserId();
  // Escape LIKE wildcards so user input matches literally.
  const escaped = normalized.replace(/[%_\\]/g, "\\$&");
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .ilike("display_name", `%${escaped}%`)
    .neq("id", me)
    .limit(10);

  return (data ?? []) as Array<{
    id: string;
    display_name: string;
    avatar_url: string | null;
  }>;
}

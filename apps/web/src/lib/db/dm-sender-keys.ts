import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import {
  dmTable,
  getActiveParticipantIds,
  type QueryResponse,
} from "@/lib/db/dm-devices";

export type DmSenderKeyRecord = {
  id: string;
  conversation_id: string;
  owner_user_id: string;
  owner_device_id: string;
  recipient_user_id: string;
  recipient_device_id: string;
  key_id: string;
  encrypted_sender_key: string;
  created_at: string;
};

export type SenderKeyEnvelopeInput = {
  ownerDeviceId: string;
  recipientUserId: string;
  recipientDeviceId: string;
  keyId: string;
  encryptedSenderKey: string;
};

const SENDER_KEY_COLUMNS =
  "id, conversation_id, owner_user_id, owner_device_id, recipient_user_id, recipient_device_id, key_id, encrypted_sender_key, created_at";

function normalizeSenderKeyRow(
  row: Record<string, unknown>,
): DmSenderKeyRecord {
  return {
    id: String(row.id ?? ""),
    conversation_id: String(row.conversation_id ?? ""),
    owner_user_id: String(row.owner_user_id ?? ""),
    owner_device_id: String(row.owner_device_id ?? ""),
    recipient_user_id: String(row.recipient_user_id ?? ""),
    recipient_device_id: String(row.recipient_device_id ?? ""),
    key_id: String(row.key_id ?? ""),
    encrypted_sender_key: String(row.encrypted_sender_key ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

export async function listRecipientSenderKeys(
  conversationId: string,
  recipientUserId: string,
  recipientDeviceId?: string,
): Promise<DmSenderKeyRecord[]> {
  const participantIds = await getActiveParticipantIds(conversationId);

  if (!participantIds.includes(recipientUserId)) {
    throw new DataAccessError(
      "You are not a participant in this conversation",
      "42501",
    );
  }

  const table = await dmTable("dm_sender_keys");
  let query = table
    .select(SENDER_KEY_COLUMNS)
    .eq("conversation_id", conversationId)
    .eq("recipient_user_id", recipientUserId);

  if (recipientDeviceId) {
    query = query.eq("recipient_device_id", recipientDeviceId);
  }

  const { data, error } = await (query.order("created_at", {
    ascending: false,
  }) as unknown as QueryResponse<Array<Record<string, unknown>>>);

  if (error) {
    throw new DataAccessError("Could not load sender keys", error.code);
  }

  return (data ?? []).map(normalizeSenderKeyRow);
}

export async function upsertSenderKeyEnvelopes(
  conversationId: string,
  ownerUserId: string,
  envelopes: SenderKeyEnvelopeInput[],
): Promise<DmSenderKeyRecord[]> {
  if (envelopes.length === 0) {
    return [];
  }

  const participantIds = await getActiveParticipantIds(conversationId);

  if (!participantIds.includes(ownerUserId)) {
    throw new DataAccessError(
      "You are not a participant in this conversation",
      "42501",
    );
  }

  const participantSet = new Set(participantIds);

  for (const envelope of envelopes) {
    if (!participantSet.has(envelope.recipientUserId)) {
      throw new DataAccessError(
        "Recipient is not an active participant in this conversation",
        "22023",
      );
    }
  }

  const rows = envelopes.map((envelope) => ({
    conversation_id: conversationId,
    owner_user_id: ownerUserId,
    owner_device_id: envelope.ownerDeviceId,
    recipient_user_id: envelope.recipientUserId,
    recipient_device_id: envelope.recipientDeviceId,
    key_id: envelope.keyId,
    encrypted_sender_key: envelope.encryptedSenderKey,
  }));

  const table = await dmTable("dm_sender_keys");
  const { data, error } = await (table
    .upsert(rows, {
      onConflict:
        "conversation_id,owner_user_id,owner_device_id,recipient_user_id,recipient_device_id,key_id",
    })
    .select(SENDER_KEY_COLUMNS) as unknown as QueryResponse<
    Array<Record<string, unknown>>
  >);

  if (error) {
    throw new DataAccessError("Could not store sender keys", error.code);
  }

  return (data ?? []).map(normalizeSenderKeyRow);
}

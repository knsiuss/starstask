import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DbError = { code?: string; message?: string } | null;

export type QueryResponse<T> = Promise<{ data: T | null; error: DbError }>;

interface UntypedFilterBuilder {
  eq: (column: string, value: unknown) => UntypedFilterBuilder;
  in: (column: string, values: readonly unknown[]) => UntypedFilterBuilder;
  is: (column: string, value: null) => UntypedFilterBuilder;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => UntypedFilterBuilder;
  limit: (count: number) => UntypedFilterBuilder;
  maybeSingle: <T>() => QueryResponse<T>;
  single: <T>() => QueryResponse<T>;
  then: Promise<{ data: unknown; error: DbError }>["then"];
}

interface UntypedTableClient {
  select: (columns: string) => UntypedFilterBuilder;
  upsert: (
    values: unknown,
    options?: { onConflict?: string },
  ) => {
    select: (columns: string) => UntypedFilterBuilder;
  };
  update: (values: unknown) => UntypedFilterBuilder;
}

export type DmDeviceKeyRecord = {
  id: string;
  user_id: string;
  device_id: string;
  device_label: string;
  identity_public_key: string;
  signed_prekey_public: string;
  one_time_prekeys: string[];
  last_active_at: string;
  revoked_at: string | null;
  created_at: string;
};

export type UpsertDeviceInput = {
  deviceId: string;
  deviceLabel: string;
  identityPublicKey: string;
  signedPrekeyPublic: string;
  oneTimePrekeys?: string[];
};

const DEVICE_COLUMNS =
  "id, user_id, device_id, device_label, identity_public_key, signed_prekey_public, one_time_prekeys, last_active_at, revoked_at, created_at";

const MAX_PUBLIC_KEY_LENGTH = 1024;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Validates that a device public key is a well-formed P-256 ECDH public key
 * (raw 65-byte uncompressed point, SPKI DER, or public-only JWK) via WebCrypto.
 */
export async function isValidP256PublicKey(value: string): Promise<boolean> {
  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_PUBLIC_KEY_LENGTH) {
    return false;
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return false;
      }

      const jwk = parsed as JsonWebKey;

      if (jwk.kty !== "EC" || jwk.crv !== "P-256" || "d" in jwk) {
        return false;
      }

      await crypto.subtle.importKey(
        "jwk",
        { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y },
        { name: "ECDH", namedCurve: "P-256" },
        false,
        [],
      );

      return true;
    } catch {
      return false;
    }
  }

  const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");

  if (!BASE64_PATTERN.test(normalized) || normalized.length % 4 !== 0) {
    return false;
  }

  const bytes = Uint8Array.from(Buffer.from(normalized, "base64"));

  if (bytes.length === 65 && bytes[0] === 0x04) {
    try {
      await crypto.subtle.importKey(
        "raw",
        bytes,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        [],
      );

      return true;
    } catch {
      return false;
    }
  }

  if (bytes.length >= 26 && bytes.length <= 128) {
    try {
      await crypto.subtle.importKey(
        "spki",
        bytes,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        [],
      );

      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export async function dmTable(table: string): Promise<UntypedTableClient> {
  const client = await createSupabaseServerClient();
  const from = client.from as unknown as (name: string) => UntypedTableClient;

  return from(table);
}

function normalizeDeviceRow(row: Record<string, unknown>): DmDeviceKeyRecord {
  const rawPrekeys = row.one_time_prekeys;
  const oneTimePrekeys = Array.isArray(rawPrekeys)
    ? rawPrekeys.filter((item): item is string => typeof item === "string")
    : [];

  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    device_id: String(row.device_id ?? ""),
    device_label: String(row.device_label ?? ""),
    identity_public_key: String(row.identity_public_key ?? ""),
    signed_prekey_public: String(row.signed_prekey_public ?? ""),
    one_time_prekeys: oneTimePrekeys,
    last_active_at: String(row.last_active_at ?? ""),
    revoked_at: typeof row.revoked_at === "string" ? row.revoked_at : null,
    created_at: String(row.created_at ?? ""),
  };
}

export async function getActiveParticipantIds(
  conversationId: string,
): Promise<string[]> {
  const participants = await dmTable("dm_participants");
  const { data, error } = await (participants
    .select("user_id")
    .eq("conversation_id", conversationId)
    .is("left_at", null) as unknown as QueryResponse<
    Array<{ user_id: string }>
  >);

  if (error) {
    throw new DataAccessError(
      "Could not verify conversation participants",
      error.code,
    );
  }

  return (data ?? []).map((row) => String(row.user_id));
}

export async function listOwnDevices(
  userId: string,
): Promise<DmDeviceKeyRecord[]> {
  const table = await dmTable("dm_device_keys");
  const { data, error } = await (table
    .select(DEVICE_COLUMNS)
    .eq("user_id", userId)
    .order("last_active_at", { ascending: false }) as unknown as QueryResponse<
    Array<Record<string, unknown>>
  >);

  if (error) {
    throw new DataAccessError("Could not load devices", error.code);
  }

  return (data ?? []).map(normalizeDeviceRow);
}

export async function upsertOwnDevice(
  userId: string,
  input: UpsertDeviceInput,
): Promise<DmDeviceKeyRecord> {
  const table = await dmTable("dm_device_keys");
  const now = new Date().toISOString();
  const { data, error } = await table
    .upsert(
      {
        user_id: userId,
        device_id: input.deviceId,
        device_label: input.deviceLabel,
        identity_public_key: input.identityPublicKey,
        signed_prekey_public: input.signedPrekeyPublic,
        one_time_prekeys: input.oneTimePrekeys ?? [],
        last_active_at: now,
        revoked_at: null,
      },
      { onConflict: "user_id,device_id" },
    )
    .select(DEVICE_COLUMNS)
    .single<Record<string, unknown>>();

  if (error || !data) {
    throw new DataAccessError("Could not register device", error?.code);
  }

  return normalizeDeviceRow(data);
}

export async function revokeOwnDevice(
  userId: string,
  deviceId: string,
): Promise<{ deviceId: string; revokedAt: string }> {
  const table = await dmTable("dm_device_keys");
  const revokedAt = new Date().toISOString();
  const { data, error } = await (
    table
      .update({ revoked_at: revokedAt })
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .is("revoked_at", null) as unknown as {
      select: (columns: string) => UntypedFilterBuilder;
    }
  )
    .select("device_id, revoked_at")
    .maybeSingle<{ device_id: string; revoked_at: string }>();

  if (error) {
    throw new DataAccessError("Could not revoke device", error.code);
  }

  if (!data) {
    throw new DataAccessError("Device not found", "PGRST116");
  }

  return {
    deviceId: String(data.device_id),
    revokedAt: String(data.revoked_at),
  };
}

export async function getConversationDeviceKeys(
  conversationId: string,
  callerUserId: string,
): Promise<DmDeviceKeyRecord[]> {
  const participantIds = await getActiveParticipantIds(conversationId);

  if (!participantIds.includes(callerUserId)) {
    throw new DataAccessError(
      "You are not a participant in this conversation",
      "42501",
    );
  }

  if (participantIds.length === 0) {
    return [];
  }

  const table = await dmTable("dm_device_keys");
  const { data, error } = await (table
    .select(DEVICE_COLUMNS)
    .in("user_id", participantIds)
    .is("revoked_at", null)
    .order("last_active_at", { ascending: false }) as unknown as QueryResponse<
    Array<Record<string, unknown>>
  >);

  if (error) {
    throw new DataAccessError(
      "Could not load conversation device keys",
      error.code,
    );
  }

  return (data ?? []).map(normalizeDeviceRow);
}

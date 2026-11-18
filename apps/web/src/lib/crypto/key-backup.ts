"use client";

/**
 * Multi-device key backup (E2EE):
 * - Private key exported JWK, wrapped with passphrase via AES-GCM.
 * - New backups: versioned `v2:<iterations>:salt:iv:cipher` with PBKDF2
 *   600k + passphrase >= 12 chars. Legacy `salt:iv:cipher` (PBKDF2 100k)
 *   backups still restore (interoperability), but new backups never use 100k.
 * - Server stores only wrapped ciphertext (dm_key_backup).
 * - Restore on new device: enter passphrase, unwrap, import, store under the
 *   canonical device key, and re-publish the public key.
 */

import {
  getDefaultDeviceLabel,
  getLocalKeyPairIfPresent,
  getOrCreateSignedPrekey,
  importKeyPairFromJwk,
  storeDeviceIdentity,
} from "@/lib/crypto/e2ee";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MIN_PASSPHRASE_LENGTH = 12;
const CURRENT_ITERATIONS = 600_000;
const LEGACY_ITERATIONS = 100_000;
const BACKUP_VERSION = "v2";

function assertPassphrase(passphrase: string): void {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(
      `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`,
    );
  }
}

async function derivePassphraseKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    const chunk = bytes.subarray(offset, offset + 8192);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const decoded = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  return new Uint8Array(decoded);
}

export async function backupPrivateKey(passphrase: string): Promise<void> {
  assertPassphrase(passphrase);

  const supabase = createSupabaseBrowserClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error("Unable to verify your session. Sign in and retry.");
  }

  const userId = userData.user?.id;

  if (!userId) {
    throw new Error("Not signed in.");
  }

  const pair = await getLocalKeyPairIfPresent();

  if (!pair) {
    throw new Error(
      "No encryption key found on this device. Set up or restore your key first.",
    );
  }

  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivePassphraseKey(passphrase, salt, CURRENT_ITERATIONS);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(jwk)),
  );
  const wrapped = [
    BACKUP_VERSION,
    String(CURRENT_ITERATIONS),
    bytesToBase64(salt),
    bytesToBase64(iv),
    bytesToBase64(new Uint8Array(cipher)),
  ].join(":");

  const { error } = await supabase.from("dm_key_backup" as any).upsert(
    {
      user_id: userId,
      wrapped_private_key: wrapped,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error("Could not save key backup to server. Try again.");
  }
}

export async function restorePrivateKey(passphrase: string): Promise<void> {
  if (!passphrase) {
    throw new Error("Enter your recovery passphrase.");
  }

  const supabase = createSupabaseBrowserClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error("Unable to verify your session. Sign in and retry.");
  }

  const userId = userData.user?.id;

  if (!userId) {
    throw new Error("Not signed in.");
  }

  const { data, error: fetchError } = await supabase
    .from("dm_key_backup" as any)
    .select("wrapped_private_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    throw new Error("Could not load key backup from server.");
  }

  if (!data) {
    throw new Error("No key backup found for this account.");
  }

  const wrapped = (data as unknown as { wrapped_private_key?: unknown })
    .wrapped_private_key;

  if (typeof wrapped !== "string" || wrapped.length === 0) {
    throw new Error("Invalid backup format.");
  }

  const parts = wrapped.split(":");
  let iterations = LEGACY_ITERATIONS;
  let saltB64 = parts[0];
  let ivB64 = parts[1];
  let cipherB64 = parts[2];

  // v2 backups carry their own iteration count; anything else is the legacy
  // 100k format and still restores (but is never written anymore).
  if (parts[0] === BACKUP_VERSION) {
    const parsedIterations = Number(parts[1]);

    if (!Number.isInteger(parsedIterations) || parsedIterations < 1) {
      throw new Error("Invalid backup format.");
    }

    iterations = parsedIterations;
    saltB64 = parts[2];
    ivB64 = parts[3];
    cipherB64 = parts[4];
  }

  if (!saltB64 || !ivB64 || !cipherB64) {
    throw new Error("Invalid backup format.");
  }

  let plain: ArrayBuffer;

  try {
    const key = await derivePassphraseKey(
      passphrase,
      base64ToBytes(saltB64),
      iterations,
    );

    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(ivB64) },
      key,
      base64ToBytes(cipherB64),
    );
  } catch {
    throw new Error("Incorrect recovery passphrase or corrupted backup.");
  }

  let pair: CryptoKeyPair;

  try {
    const jwk = JSON.parse(new TextDecoder().decode(plain)) as JsonWebKey;

    pair = await importKeyPairFromJwk(jwk);
  } catch {
    throw new Error("Backed-up key data is invalid.");
  }

  // Store under the canonical device key: anything else would be orphaned
  // (this was the "self-private-only" bug).
  const { deviceId, publicKey } = await storeDeviceIdentity(pair);

  // Re-publish the public key so peers encrypt to the restored keypair.
  const response = await fetch("/api/dm/keys/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicKey }),
  });

  if (!response.ok) {
    throw new Error("Key restored locally, but sync failed. Retry setup.");
  }

  await registerCurrentDevice(deviceId, publicKey);
}

export async function registerCurrentDevice(
  deviceId: string,
  identityPublicKey: string,
): Promise<void> {
  const signedPrekey = await getOrCreateSignedPrekey();
  const deviceResponse = await fetch("/api/dm/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId,
      deviceLabel: getDefaultDeviceLabel(),
      identityPublicKey,
      signedPrekeyPublic: signedPrekey.publicKey,
      oneTimePrekeys: [],
    }),
  });

  if (!deviceResponse.ok) {
    throw new Error("Device registration failed. Reload and retry.");
  }
}

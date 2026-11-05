"use client";

/**
 * Multi-device key backup (E2EE):
 * - Private key exported JWK, wrapped with passphrase via AES-GCM (PBKDF2 100k).
 * - Server stores only wrapped ciphertext (dm_key_backup).
 * - Restore on new device: enter passphrase, unwrap, import.
 */

import { exportPublicKey, getOrCreateKeyPair } from "@/lib/crypto/e2ee";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

async function derivePassphraseKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
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
      iterations: 100_000,
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
  const supabase = createSupabaseBrowserClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  const pair = await getOrCreateKeyPair();
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivePassphraseKey(passphrase, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(jwk)),
  );
  const wrapped = [
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
  if (error) throw error;
}

export async function restorePrivateKey(passphrase: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  const { data } = await supabase
    .from("dm_key_backup" as any)
    .select("wrapped_private_key")
    .eq("user_id", userId)
    .single();
  if (!data) throw new Error("No backup found");

  const wrapped = (data as unknown as { wrapped_private_key: string })
    .wrapped_private_key;
  const [saltB64, ivB64, cipherB64] = wrapped.split(":");
  if (!saltB64 || !ivB64 || !cipherB64) {
    throw new Error("Invalid backup format");
  }
  const key = await derivePassphraseKey(passphrase, base64ToBytes(saltB64));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivB64) },
    key,
    base64ToBytes(cipherB64),
  );
  const jwk = JSON.parse(new TextDecoder().decode(plain)) as JsonWebKey;

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );

  // Re-derive public from private via ECDH export of matching keypair is
  // not possible from JWK alone in WebCrypto; store private only and let
  // next login re-export public via getOrCreateKeyPair flow in dm-key-setup.
  const db = await new Promise<IDBDatabase>((resolve) => {
    const req = indexedDB.open("starstask-e2ee", 1);
    req.onsuccess = () => resolve(req.result);
  });
  await new Promise<void>((resolve, reject) => {
    const req = db
      .transaction("keys", "readwrite")
      .objectStore("keys")
      .put(privateKey, "self-private-only");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

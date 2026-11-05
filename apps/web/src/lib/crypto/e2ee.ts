"use client";

/**
 * E2EE DM v1 (teaching-grade, not Signal protocol):
 * - ECDH P-256 keypair per user; private key stays in IndexedDB.
 * - Shared secret via ECDH + HKDF, AES-GCM-256 per message.
 * - Wire format: base64(iv) + ":" + base64(ciphertext).
 * Limitations: no forward-secrecy rotation, no group, lost
 * device = lost history.
 */

const DB_NAME = "starstask-e2ee";
const STORE = "keys";
const SELF_KEY = "self";
const IV_BYTES = 12;
const HKDF_SALT = "starstask-e2ee-v1";
const HKDF_INFO = "dm";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (): void => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => reject(request.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();

  return new Promise<T | null>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(key);

    request.onsuccess = (): void => {
      resolve((request.result as T) ?? null);
    };
    request.onerror = (): void => reject(request.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();

  return new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(STORE, "readwrite")
      .objectStore(STORE)
      .put(value, key);

    request.onsuccess = (): void => resolve();
    request.onerror = (): void => reject(request.error);
  });
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );
}

export async function getOrCreateKeyPair(): Promise<CryptoKeyPair> {
  const existing = await idbGet<CryptoKeyPair>(SELF_KEY);

  if (existing) {
    return existing;
  }

  const pair = await generateKeyPair();

  await idbSet(SELF_KEY, pair);

  return pair;
}

/**
 * Totally replaces the device keypair (backup restore). This is the correct
 * storage location: `getOrCreateKeyPair` only reads `SELF_KEY`, so anything
 * written elsewhere is orphaned.
 */
export async function storeSelfKeyPair(pair: CryptoKeyPair): Promise<void> {
  await idbSet(SELF_KEY, pair);
}

/** Rebuilds a keypair from its JWK parts (private `d` + public `x`/`y`). */
export async function importKeyPairFromJwk(
  jwk: JsonWebKey,
): Promise<CryptoKeyPair> {
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );

  return { publicKey, privateKey };
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

  // Copy into a fresh ArrayBuffer so the result satisfies BufferSource.
  return new Uint8Array(decoded);
}

export async function exportPublicKey(pair: CryptoKeyPair): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", pair.publicKey);

  return bytesToBase64(new Uint8Array(raw));
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    base64ToBytes(base64),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
}

export type ParsedWire = {
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: Uint8Array<ArrayBuffer>;
};

export function parseWireFormat(wire: string): ParsedWire | null {
  const separatorIndex = wire.indexOf(":");

  if (separatorIndex <= 0) {
    return null;
  }

  const ivPart = wire.slice(0, separatorIndex);
  const cipherPart = wire.slice(separatorIndex + 1);

  if (!ivPart || !cipherPart || cipherPart.includes(":")) {
    return null;
  }

  try {
    const iv = base64ToBytes(ivPart);
    const ciphertext = base64ToBytes(cipherPart);

    if (iv.length !== IV_BYTES || ciphertext.length === 0) {
      return null;
    }

    return { iv, ciphertext };
  } catch {
    return null;
  }
}

export function isValidWireFormat(wire: string): boolean {
  return parseWireFormat(wire) !== null;
}

async function deriveAesKey(
  selfPair: CryptoKeyPair,
  peerPublicBase64: string,
): Promise<CryptoKey> {
  const peer = await importPublicKey(peerPublicBase64);
  const shared = await crypto.subtle.deriveBits(
    { name: "ECDH", public: peer },
    selfPair.privateKey,
    256,
  );
  const hkdfKey = await crypto.subtle.importKey("raw", shared, "HKDF", false, [
    "deriveKey",
  ]);

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      salt: new TextEncoder().encode(HKDF_SALT),
      info: new TextEncoder().encode(HKDF_INFO),
      hash: "SHA-256",
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptWithKeyPair(
  selfPair: CryptoKeyPair,
  peerPublicBase64: string,
  plaintext: string,
): Promise<string> {
  const key = await deriveAesKey(selfPair, peerPublicBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  return `${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipher))}`;
}

export async function decryptWithKeyPair(
  selfPair: CryptoKeyPair,
  peerPublicBase64: string,
  wire: string,
): Promise<string> {
  const parsed = parseWireFormat(wire);

  if (!parsed) {
    throw new Error("Invalid ciphertext format");
  }

  const key = await deriveAesKey(selfPair, peerPublicBase64);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: parsed.iv },
    key,
    parsed.ciphertext,
  );

  return new TextDecoder().decode(plain);
}

export async function encryptMessage(
  peerPublicBase64: string,
  plaintext: string,
): Promise<string> {
  const self = await getOrCreateKeyPair();

  return encryptWithKeyPair(self, peerPublicBase64, plaintext);
}

export async function decryptMessage(
  peerPublicBase64: string,
  wire: string,
): Promise<string> {
  const self = await getOrCreateKeyPair();

  return decryptWithKeyPair(self, peerPublicBase64, wire);
}

export async function getSafetyFingerprint(
  peerPublicBase64: string,
): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(peerPublicBase64),
  );
  const hex = [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join("");
  return hex.match(/.{1,4}/g)?.join("-").slice(0, 29) ?? hex.slice(0, 29);
}

/** Encrypt file bytes (image/video/files) with conversation key. Returns wire iv:ciphertext base64. */
export async function encryptFile(
  peerPublicBase64: string,
  data: ArrayBuffer,
): Promise<string> {
  const self = await getOrCreateKeyPair();
  const key = await deriveAesKey(self, peerPublicBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return `${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipher))}`;
}

export async function decryptFile(
  peerPublicBase64: string,
  wire: string,
): Promise<ArrayBuffer> {
  const self = await getOrCreateKeyPair();
  const key = await deriveAesKey(self, peerPublicBase64);
  const parsed = parseWireFormat(wire);
  if (!parsed) throw new Error("Invalid ciphertext");
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: parsed.iv },
    key,
    parsed.ciphertext,
  );
}

export const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // 25MB
export const ALLOWED_MEDIA_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "text/",
];
export function isAllowedMedia(mime: string): boolean {
  return (
    ALLOWED_MEDIA_PREFIXES.some((p) => mime.startsWith(p)) ||
    mime === "application/zip"
  );
}

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
const DEVICE_ID_KEY = "device-id";
const SIGNED_PREKEY_KEY = "signed-prekey";
const IV_BYTES = 12;
const HKDF_SALT = "starstask-e2ee-v1";
const HKDF_INFO = "dm";

let dbPromise: Promise<IDBDatabase> | null = null;
let pendingKeyPair: Promise<CryptoKeyPair> | null = null;
let pendingDeviceId: Promise<string> | null = null;
let pendingSignedPrekey: Promise<SignedPrekeyPair> | null = null;

export type SignedPrekeyPair = {
  keyPair: CryptoKeyPair;
  publicKey: string;
};

function resetDb(): void {
  dbPromise = null;
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available."));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (): void => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };

    request.onblocked = (): void => {
      resetDb();
      reject(
        new Error(
          "Encryption storage is blocked by another tab. Close other tabs and retry.",
        ),
      );
    };

    request.onsuccess = (): void => {
      const db = request.result;

      db.onversionchange = (): void => {
        db.close();
        resetDb();
      };
      db.onclose = (): void => {
        resetDb();
      };
      db.onerror = (): void => {
        resetDb();
      };

      resolve(db);
    };

    request.onerror = (): void => {
      resetDb();
      reject(request.error ?? new Error("Failed to open encryption storage."));
    };
  });

  return dbPromise;
}

async function idbGet<T>(key: string): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const db = await openDb();

      return await new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const request = tx.objectStore(STORE).get(key);

        request.onsuccess = (): void => {
          resolve((request.result as T) ?? null);
        };
        request.onerror = (): void =>
          reject(request.error ?? new Error("Failed to read key storage."));
        tx.onabort = (): void =>
          reject(tx.error ?? new Error("Key storage read aborted."));
      });
    } catch (error) {
      if (
        attempt === 0 &&
        error instanceof DOMException &&
        error.name === "InvalidStateError"
      ) {
        resetDb();
        continue;
      }

      throw error;
    }
  }

  return null;
}

async function idbSet(key: string, value: unknown): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const db = await openDb();

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const request = tx.objectStore(STORE).put(value, key);

        tx.oncomplete = (): void => resolve();
        request.onerror = (): void =>
          reject(request.error ?? new Error("Failed to write key storage."));
        tx.onerror = (): void =>
          reject(tx.error ?? new Error("Key storage write failed."));
        tx.onabort = (): void =>
          reject(tx.error ?? new Error("Key storage write aborted."));
      });

      return;
    } catch (error) {
      if (
        attempt === 0 &&
        error instanceof DOMException &&
        error.name === "InvalidStateError"
      ) {
        resetDb();
        continue;
      }

      throw error;
    }
  }
}

function isValidKeyPair(value: unknown): value is CryptoKeyPair {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CryptoKeyPair>;

  return Boolean(
    candidate.publicKey &&
    candidate.privateKey &&
    typeof candidate.publicKey === "object" &&
    typeof candidate.privateKey === "object" &&
    "type" in candidate.publicKey &&
    "type" in candidate.privateKey,
  );
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );
}

/**
 * Returns the device identity keypair from IndexedDB if present and valid,
 * without creating a new one when missing.
 */
export async function getLocalKeyPairIfPresent(): Promise<CryptoKeyPair | null> {
  const existing = await idbGet<unknown>(SELF_KEY);

  return isValidKeyPair(existing) ? existing : null;
}

export async function getOrCreateKeyPair(): Promise<CryptoKeyPair> {
  if (pendingKeyPair) {
    return pendingKeyPair;
  }

  pendingKeyPair = (async () => {
    const existing = await getLocalKeyPairIfPresent();

    if (existing) {
      return existing;
    }

    const pair = await generateKeyPair();

    await idbSet(SELF_KEY, pair);

    return pair;
  })();

  try {
    return await pendingKeyPair;
  } finally {
    pendingKeyPair = null;
  }
}

/**
 * Totally replaces the device keypair (backup restore). This is the correct
 * storage location: `getOrCreateKeyPair` only reads `SELF_KEY`, so anything
 * written elsewhere is orphaned.
 */
export async function storeSelfKeyPair(pair: CryptoKeyPair): Promise<void> {
  if (!isValidKeyPair(pair)) {
    throw new Error("Invalid encryption keypair.");
  }

  await idbSet(SELF_KEY, pair);
}

export async function getOrCreateDeviceId(): Promise<string> {
  if (pendingDeviceId) {
    return pendingDeviceId;
  }

  pendingDeviceId = (async () => {
    const existing = await idbGet<unknown>(DEVICE_ID_KEY);

    if (typeof existing === "string" && existing.trim().length > 0) {
      return existing;
    }

    const deviceId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));

    await idbSet(DEVICE_ID_KEY, deviceId);

    return deviceId;
  })();

  try {
    return await pendingDeviceId;
  } finally {
    pendingDeviceId = null;
  }
}

export async function getOrCreateSignedPrekey(): Promise<SignedPrekeyPair> {
  if (pendingSignedPrekey) {
    return pendingSignedPrekey;
  }

  pendingSignedPrekey = (async () => {
    const existing = await idbGet<unknown>(SIGNED_PREKEY_KEY);

    if (isValidKeyPair(existing)) {
      return {
        keyPair: existing,
        publicKey: await exportPublicKey(existing),
      };
    }

    const keyPair = await generateKeyPair();

    await idbSet(SIGNED_PREKEY_KEY, keyPair);

    return {
      keyPair,
      publicKey: await exportPublicKey(keyPair),
    };
  })();

  try {
    return await pendingSignedPrekey;
  } finally {
    pendingSignedPrekey = null;
  }
}

export async function storeDeviceIdentity(
  pair: CryptoKeyPair,
  options?: { deviceId?: string; signedPrekey?: CryptoKeyPair },
): Promise<{ deviceId: string; publicKey: string }> {
  await storeSelfKeyPair(pair);

  let deviceId: string;

  if (options?.deviceId && options.deviceId.trim().length > 0) {
    deviceId = options.deviceId.trim();
    await idbSet(DEVICE_ID_KEY, deviceId);
  } else {
    deviceId = await getOrCreateDeviceId();
  }

  if (options?.signedPrekey) {
    if (!isValidKeyPair(options.signedPrekey)) {
      throw new Error("Invalid signed prekey pair.");
    }

    await idbSet(SIGNED_PREKEY_KEY, options.signedPrekey);
  }

  return {
    deviceId,
    publicKey: await exportPublicKey(pair),
  };
}

export function getDefaultDeviceLabel(): string {
  if (typeof navigator === "undefined") {
    return "Web browser";
  }

  const ua = navigator.userAgent;
  const browser = ua.includes("Edg/")
    ? "Edge"
    : ua.includes("Chrome/")
      ? "Chrome"
      : ua.includes("Firefox/")
        ? "Firefox"
        : ua.includes("Safari/")
          ? "Safari"
          : "Browser";
  const os = ua.includes("Windows")
    ? "Windows"
    : ua.includes("Mac OS")
      ? "macOS"
      : ua.includes("Android")
        ? "Android"
        : ua.includes("iPhone") || ua.includes("iPad")
          ? "iOS"
          : ua.includes("Linux")
            ? "Linux"
            : "Unknown OS";

  return `${browser} on ${os}`;
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
  version: 1 | 2;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: Uint8Array<ArrayBuffer>;
};

export function parseWireFormat(wire: string): ParsedWire | null {
  // v1 (legacy, no AAD): `iv:ciphertext`
  // v2 (AAD-bound): `v2:iv:ciphertext`
  const isV2 = wire.startsWith("v2:");
  const rest = isV2 ? wire.slice(3) : wire;
  const separatorIndex = rest.indexOf(":");

  if (separatorIndex <= 0) {
    return null;
  }

  const ivPart = rest.slice(0, separatorIndex);
  const cipherPart = rest.slice(separatorIndex + 1);

  if (!ivPart || !cipherPart || cipherPart.includes(":")) {
    return null;
  }

  try {
    const iv = base64ToBytes(ivPart);
    const ciphertext = base64ToBytes(cipherPart);

    if (iv.length !== IV_BYTES || ciphertext.length === 0) {
      return null;
    }

    return { version: isV2 ? 2 : 1, iv, ciphertext };
  } catch {
    return null;
  }
}

export function isValidWireFormat(wire: string): boolean {
  return parseWireFormat(wire) !== null;
}

/**
 * AAD binding for v2 messages (QA-05). The ciphertext is cryptographically
 * bound to its conversation + sender + protocol version, so it cannot be
 * transplanted into another conversation context. v1 messages (no AAD)
 * remain readable for backward compatibility.
 */
export function buildAad(
  conversationId: string,
  senderId: string,
  keyEpoch = 1,
): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(
    `starstask-dm-v2|${conversationId}|${senderId}|${keyEpoch}`,
  );
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
  aad?: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const key = await deriveAesKey(selfPair, peerPublicBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, ...(aad ? { additionalData: aad } : {}) },
    key,
    new TextEncoder().encode(plaintext),
  );

  const body = `${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipher))}`;

  return aad ? `v2:${body}` : body;
}

export async function decryptWithKeyPair(
  selfPair: CryptoKeyPair,
  peerPublicBase64: string,
  wire: string,
  aad?: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const parsed = parseWireFormat(wire);

  if (!parsed) {
    throw new Error("Invalid ciphertext format");
  }

  // v2 wires MUST decrypt with AAD; v1 wires fall back without it (legacy).
  const expectedAad = parsed.version === 2 ? aad : undefined;

  if (parsed.version === 2 && !expectedAad) {
    throw new Error("Missing context for AAD-bound message");
  }

  const key = await deriveAesKey(selfPair, peerPublicBase64);
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: parsed.iv,
      ...(expectedAad ? { additionalData: expectedAad } : {}),
    },
    key,
    parsed.ciphertext,
  );

  return new TextDecoder().decode(plain);
}

export async function encryptMessage(
  peerPublicBase64: string,
  plaintext: string,
  context?: { conversationId: string; senderId: string },
): Promise<string> {
  const self = await getOrCreateKeyPair();
  const aad = context
    ? buildAad(context.conversationId, context.senderId)
    : undefined;

  return encryptWithKeyPair(self, peerPublicBase64, plaintext, aad);
}

export async function decryptMessage(
  peerPublicBase64: string,
  wire: string,
  context?: { conversationId: string; senderId: string },
): Promise<string> {
  const self = await getOrCreateKeyPair();
  const aad = context
    ? buildAad(context.conversationId, context.senderId)
    : undefined;

  return decryptWithKeyPair(self, peerPublicBase64, wire, aad);
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
  return (
    hex
      .match(/.{1,4}/g)
      ?.join("-")
      .slice(0, 29) ?? hex.slice(0, 29)
  );
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

export type GroupEnvelope = {
  iv: string;
  cipher: string;
};

/**
 * Group encryption (QA-04, per-recipient envelopes):
 * - a random data key encrypts the message (AAD-bound, v2 wire format);
 * - the data key itself is wrapped for each member with their ECDH-derived
 *   key and stored as envelopes the server passes through opaque.
 * The server never sees the data key; non-members get unusable wraps.
 */
export async function generateDataKey(): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}

export async function wrapDataKey(
  selfPair: CryptoKeyPair,
  peerPublicBase64: string,
  dataKey: Uint8Array,
): Promise<GroupEnvelope> {
  const recipientKey = await deriveAesKey(selfPair, peerPublicBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    recipientKey,
    dataKey as BufferSource,
  );

  return {
    iv: bytesToBase64(iv),
    cipher: bytesToBase64(new Uint8Array(cipher)),
  };
}

export async function unwrapDataKey(
  selfPair: CryptoKeyPair,
  peerPublicBase64: string,
  envelope: GroupEnvelope,
): Promise<Uint8Array<ArrayBuffer>> {
  const recipientKey = await deriveAesKey(selfPair, peerPublicBase64);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
    recipientKey,
    base64ToBytes(envelope.cipher),
  );

  return new Uint8Array(plain);
}

export async function encryptWithDataKey(
  dataKey: Uint8Array,
  plaintext: string,
  aad: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    dataKey as BufferSource,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad },
    key,
    new TextEncoder().encode(plaintext),
  );

  return `v2:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipher))}`;
}

export async function decryptWithDataKey(
  dataKey: Uint8Array,
  wire: string,
  aad: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const parsed = parseWireFormat(wire);
  if (!parsed || parsed.version !== 2) {
    throw new Error("Invalid ciphertext format");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    dataKey as BufferSource,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: parsed.iv, additionalData: aad },
    key,
    parsed.ciphertext,
  );

  return new TextDecoder().decode(plain);
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

/**
 * Replay guard (QA-05): remembers wire IVs per conversation in IndexedDB so
 * the same ciphertext cannot be re-rendered as a new message. Exact-duplicate
 * detection only (not full transcript ordering); capped at 1000 entries per
 * conversation with simple FIFO trimming.
 */
const SEEN_CAP = 1000;

async function seenGet(conversationId: string): Promise<string[]> {
  const value = await idbGet<string[]>(`seen:${conversationId}`);

  return value ?? [];
}

async function seenAdd(conversationId: string, ivHex: string): Promise<void> {
  const entries = await seenGet(conversationId);

  if (entries.includes(ivHex)) {
    return;
  }

  const trimmed = [...entries, ivHex].slice(-SEEN_CAP);

  await idbSet(`seen:${conversationId}`, trimmed);
}

/** Returns true when the IV was already seen for this conversation. */
export async function isReplay(
  conversationId: string,
  wire: string,
): Promise<boolean> {
  const parsed = parseWireFormat(wire);

  if (!parsed) {
    return true;
  }

  const ivHex = [...parsed.iv]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if ((await seenGet(conversationId)).includes(ivHex)) {
    return true;
  }

  await seenAdd(conversationId, ivHex);

  return false;
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

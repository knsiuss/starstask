const MEDIA_KEY_BYTES = 32;
const MEDIA_IV_BYTES = 12;
const AES_IV_BYTES = 12;
const SAFETY_GROUPS = 12;
const SAFETY_GROUP_MOD = 100000;

export type Bytes = Uint8Array<ArrayBuffer>;

export type EncryptedMediaResult = {
  encryptedBytes: Bytes;
  keyB64: string;
  ivB64: string;
  sha256B64: string;
};

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }

  return btoa(binary);
}

export function base64ToBytes(value: string): Bytes {
  const decoded = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

  // Copy into a fresh ArrayBuffer so the result satisfies BufferSource.
  return new Uint8Array(decoded);
}

export async function aesGcmEncrypt(
  keyBytes: Bytes,
  plaintext: string,
  aad: Bytes,
): Promise<{ iv: string; ct: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_BYTES));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
  ]);
  const data = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad },
    key,
    data,
  );

  return {
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function aesGcmDecrypt(
  keyBytes: Bytes,
  ivB64: string,
  ctB64: string,
  aad: Bytes,
): Promise<string> {
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "decrypt",
  ]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivB64), additionalData: aad },
    key,
    base64ToBytes(ctB64),
  );

  return new TextDecoder().decode(decrypted);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;

  for (let i = 0; i < a.length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  return diff === 0;
}

export async function encryptMediaBytes(
  bytes: Uint8Array,
): Promise<EncryptedMediaResult> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(MEDIA_KEY_BYTES));
  const ivBytes = crypto.getRandomValues(new Uint8Array(MEDIA_IV_BYTES));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
  ]);
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    new Uint8Array(bytes),
  );
  const encryptedBytes = new Uint8Array(encryptedBuf);
  const digestBuf = await crypto.subtle.digest("SHA-256", encryptedBytes);

  return {
    encryptedBytes,
    keyB64: bytesToBase64(keyBytes),
    ivB64: bytesToBase64(ivBytes),
    sha256B64: bytesToBase64(new Uint8Array(digestBuf)),
  };
}

export async function decryptMediaBytes(
  encryptedBytes: Uint8Array,
  keyB64: string,
  ivB64: string,
  sha256B64: string,
): Promise<Bytes> {
  const safeEncrypted = new Uint8Array(encryptedBytes);
  const actualDigest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", safeEncrypted),
  );

  if (!constantTimeEqual(actualDigest, base64ToBytes(sha256B64))) {
    throw new Error("Encrypted media SHA-256 integrity check failed");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(keyB64),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivB64) },
    key,
    safeEncrypted,
  );

  return new Uint8Array(plainBuf);
}

export async function computeSafetyNumber(
  pubKeyA: string,
  pubKeyB: string,
): Promise<string> {
  const [first, second] =
    pubKeyA <= pubKeyB ? [pubKeyA, pubKeyB] : [pubKeyB, pubKeyA];
  const encoder = new TextEncoder();
  const groups: string[] = [];

  for (let i = 0; i < SAFETY_GROUPS; i += 1) {
    const input = new Uint8Array(encoder.encode(`${first}|${second}|${i}`));
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
    const view = new DataView(
      digest.buffer,
      digest.byteOffset,
      digest.byteLength,
    );
    const num = view.getUint32(0, false) % SAFETY_GROUP_MOD;

    groups.push(num.toString().padStart(5, "0"));
  }

  return groups.join(" ");
}

export function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = (): void => resolve(req.result);
    req.onerror = (): void => reject(req.error);
  });
}

export async function idbStoreRun<T>(
  dbName: string,
  stores: readonly string[],
  storeName: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const req = indexedDB.open(dbName, 1);

  req.onupgradeneeded = (): void => {
    for (const s of stores) {
      if (!req.result.objectStoreNames.contains(s)) {
        req.result.createObjectStore(s);
      }
    }
  };

  const db = await idbReq(req);

  return idbReq(fn(db.transaction(storeName, mode).objectStore(storeName)));
}

export function idbBucket<T>(
  dbName: string,
  stores: readonly string[],
  storeName: string,
) {
  const run = <R>(
    mode: IDBTransactionMode,
    fn: (s: IDBObjectStore) => IDBRequest<R>,
  ) => idbStoreRun(dbName, stores, storeName, mode, fn);

  return {
    get: (k: string): Promise<T | null> =>
      run<T | undefined>("readonly", (s) => s.get(k)).then((r) => r ?? null),
    set: (k: string, v: T): Promise<void> =>
      run("readwrite", (s) => s.put(v, k)).then(() => undefined),
    del: (k: string): Promise<void> =>
      run("readwrite", (s) => s.delete(k)).then(() => undefined),
  };
}

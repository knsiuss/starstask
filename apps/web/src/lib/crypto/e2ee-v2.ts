import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  base64ToBytes,
  bytesToBase64,
  idbBucket,
  type Bytes,
} from "./e2ee-media";
import {
  ecdhDeriveBits,
  kdfChainKey,
  MAX_SKIP,
  type RatchetState,
} from "./e2ee-ratchet";

export const V2_PREFIX = "v2:";
export const V2G_PREFIX = "v2g:";

const X3DH_SALT = new TextEncoder().encode("starstask-x3dh-v2");
const X3DH_INFO = new TextEncoder().encode("shared-secret");
const DEFAULT_DB_NAME = "starstask-e2ee-v2";
const RATCHET_STORE = "ratchets";
const SENDER_KEY_STORE = "sender_keys";
const { subtle } = crypto;

export type EncryptedMediaMeta = {
  storagePath: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  keyB64: string;
  ivB64: string;
  sha256B64: string;
};

export type DecryptedPayload = { text?: string; media?: EncryptedMediaMeta };

export type V2DeviceEnvelope = {
  senderDeviceId: string;
  dhPub: string;
  n: number;
  pn: number;
  iv: string;
  ct: string;
  senderEphemeralPublicKey?: string;
};

export type V2Envelope = { v: 2; envelopes: Record<string, V2DeviceEnvelope> };

export type V2GroupEnvelope = {
  v: 2;
  senderDeviceId: string;
  keyId: string;
  iteration: number;
  iv: string;
  ct: string;
};

export type SenderKeyState = {
  keyId: string;
  senderDeviceId: string;
  chainKeyB64: string;
  iteration: number;
  skipped: Record<number, string>;
};

export interface RatchetStore {
  getRatchet(sessionKey: string): Promise<RatchetState | null>;
  setRatchet(sessionKey: string, state: RatchetState): Promise<void>;
  deleteRatchet(sessionKey: string): Promise<void>;
  getSenderKey(groupKey: string): Promise<SenderKeyState | null>;
  setSenderKey(groupKey: string, state: SenderKeyState): Promise<void>;
  deleteSenderKey(groupKey: string): Promise<void>;
}

export const isV2Wire = (wire: string): boolean =>
  wire.startsWith(V2_PREFIX) || wire.startsWith(V2G_PREFIX);

function parsePrefixedJson<T>(
  wire: string,
  prefix: string,
  guard: (val: Record<string, unknown>) => boolean,
): T | null {
  if (!wire.startsWith(prefix)) return null;

  try {
    const parsed: unknown = JSON.parse(wire.slice(prefix.length));

    if (typeof parsed === "object" && parsed !== null) {
      return guard(parsed as Record<string, unknown>) ? (parsed as T) : null;
    }

    return null;
  } catch {
    return null;
  }
}

export const serializeV2Envelope = (e: V2Envelope): string =>
  `${V2_PREFIX}${JSON.stringify(e)}`;

export const parseV2Envelope = (wire: string): V2Envelope | null =>
  parsePrefixedJson<V2Envelope>(
    wire,
    V2_PREFIX,
    (r) => r.v === 2 && typeof r.envelopes === "object" && r.envelopes !== null,
  );

export const serializeV2GroupEnvelope = (e: V2GroupEnvelope): string =>
  `${V2G_PREFIX}${JSON.stringify(e)}`;

export const parseV2GroupEnvelope = (wire: string): V2GroupEnvelope | null =>
  parsePrefixedJson<V2GroupEnvelope>(
    wire,
    V2G_PREFIX,
    (r) =>
      r.v === 2 &&
      typeof r.senderDeviceId === "string" &&
      typeof r.keyId === "string" &&
      typeof r.iteration === "number" &&
      typeof r.iv === "string" &&
      typeof r.ct === "string",
  );

export async function deriveInitialSharedSecret(
  localIdentityPriv: CryptoKey,
  remoteIdentityPub: CryptoKey,
  remotePrekeyPub: CryptoKey,
  localPrekeyPriv?: CryptoKey,
): Promise<Bytes> {
  const [dh1, dh2] = await Promise.all([
    ecdhDeriveBits(localIdentityPriv, remoteIdentityPub),
    ecdhDeriveBits(localPrekeyPriv ?? localIdentityPriv, remotePrekeyPub),
  ]);
  const combined = new Uint8Array(dh1.length + dh2.length);

  combined.set(dh1, 0);
  combined.set(dh2, dh1.length);

  const ikm = await subtle.importKey("raw", combined, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: X3DH_SALT, info: X3DH_INFO },
    ikm,
    256,
  );

  return new Uint8Array(bits);
}

export const deriveResponderSharedSecret = (
  localIdPriv: CryptoKey,
  localPrekeyPriv: CryptoKey,
  remoteIdPub: CryptoKey,
  remoteEphemeralPub?: CryptoKey,
): Promise<Bytes> =>
  deriveInitialSharedSecret(
    localIdPriv,
    remoteIdPub,
    remoteEphemeralPub ?? remoteIdPub,
    localPrekeyPriv,
  );

const groupAad = (senderDeviceId: string, keyId: string, iter: number): Bytes =>
  new Uint8Array(
    new TextEncoder().encode(`${senderDeviceId}|${keyId}|${iter}`),
  );

export function createSenderKeyState(
  senderDeviceId: string,
  keyId = crypto.randomUUID(),
  seedChainKeyB64?: string,
): SenderKeyState {
  const chainKeyB64 =
    seedChainKeyB64 ??
    bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));

  return { keyId, senderDeviceId, chainKeyB64, iteration: 0, skipped: {} };
}

export async function encryptGroupMessage(
  state: SenderKeyState,
  plaintext: string,
): Promise<{ state: SenderKeyState; envelope: V2GroupEnvelope }> {
  const [nextCk, msgKey] = await kdfChainKey(base64ToBytes(state.chainKeyB64));
  const aad = groupAad(state.senderDeviceId, state.keyId, state.iteration);
  const { iv, ct } = await aesGcmEncrypt(msgKey, plaintext, aad);

  return {
    state: {
      ...state,
      chainKeyB64: bytesToBase64(nextCk),
      iteration: state.iteration + 1,
      skipped: { ...state.skipped },
    },
    envelope: {
      v: 2,
      senderDeviceId: state.senderDeviceId,
      keyId: state.keyId,
      iteration: state.iteration,
      iv,
      ct,
    },
  };
}

export async function decryptGroupMessage(
  state: SenderKeyState,
  env: V2GroupEnvelope,
): Promise<{ state: SenderKeyState; plaintext: string }> {
  if (
    env.keyId !== state.keyId ||
    env.senderDeviceId !== state.senderDeviceId
  ) {
    throw new Error("Sender key identity mismatch");
  }

  const aad = groupAad(env.senderDeviceId, env.keyId, env.iteration);
  const skippedKeyB64 = state.skipped[env.iteration];

  if (skippedKeyB64) {
    const nextSkipped = { ...state.skipped };

    delete nextSkipped[env.iteration];
    const plaintext = await aesGcmDecrypt(
      base64ToBytes(skippedKeyB64),
      env.iv,
      env.ct,
      aad,
    );

    return { state: { ...state, skipped: nextSkipped }, plaintext };
  }

  if (env.iteration < state.iteration) {
    throw new Error("Duplicate or expired group message iteration");
  }

  if (env.iteration - state.iteration > MAX_SKIP) {
    throw new Error("Exceeded MAX_SKIP for group messages");
  }

  let chainKey = base64ToBytes(state.chainKeyB64);
  let iter = state.iteration;
  const skipped = { ...state.skipped };

  while (iter < env.iteration) {
    const [nextCk, msgKey] = await kdfChainKey(chainKey);

    skipped[iter] = bytesToBase64(msgKey);
    chainKey = nextCk;
    iter += 1;
  }

  const [nextCk, msgKey] = await kdfChainKey(chainKey);
  const plaintext = await aesGcmDecrypt(msgKey, env.iv, env.ct, aad);

  return {
    state: {
      ...state,
      chainKeyB64: bytesToBase64(nextCk),
      iteration: iter + 1,
      skipped,
    },
    plaintext,
  };
}

export function createMemoryRatchetStore(): RatchetStore {
  const ratchets = new Map<string, RatchetState>();
  const senderKeys = new Map<string, SenderKeyState>();

  return {
    getRatchet: async (k) => ratchets.get(k) ?? null,
    setRatchet: async (k, s) => void ratchets.set(k, s),
    deleteRatchet: async (k) => void ratchets.delete(k),
    getSenderKey: async (k) => senderKeys.get(k) ?? null,
    setSenderKey: async (k, s) => void senderKeys.set(k, s),
    deleteSenderKey: async (k) => void senderKeys.delete(k),
  };
}

export function createIndexedDbRatchetStore(
  dbName = DEFAULT_DB_NAME,
): RatchetStore {
  const stores = [RATCHET_STORE, SENDER_KEY_STORE] as const;
  const r = idbBucket<RatchetState>(dbName, stores, RATCHET_STORE);
  const sk = idbBucket<SenderKeyState>(dbName, stores, SENDER_KEY_STORE);

  return {
    getRatchet: r.get,
    setRatchet: r.set,
    deleteRatchet: r.del,
    getSenderKey: sk.get,
    setSenderKey: sk.set,
    deleteSenderKey: sk.del,
  };
}

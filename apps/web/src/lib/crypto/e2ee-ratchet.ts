import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  base64ToBytes,
  bytesToBase64,
  type Bytes,
} from "./e2ee-media";

export { base64ToBytes, bytesToBase64 };

export const MAX_SKIP = 100;

const KEY_BYTES = 32;
const RK_INFO = new TextEncoder().encode("starstask-dr-rk-v2");
const MSG_LABEL = new Uint8Array([0x01]);
const CHAIN_LABEL = new Uint8Array([0x02]);
const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;
const { subtle } = crypto;

export type RatchetHeader = { dhPub: string; n: number; pn: number };
export type SerializedKeyPair = { pubB64: string; privJwk: JsonWebKey };

export type RatchetState = {
  dhSelf: SerializedKeyPair;
  dhRemotePubB64: string | null;
  rootKeyB64: string;
  sendChainKeyB64: string | null;
  recvChainKeyB64: string | null;
  ns: number;
  nr: number;
  pn: number;
  skipped: Record<string, string>;
};

export const generateEcdhKeyPair = (): Promise<CryptoKeyPair> =>
  subtle.generateKey(ECDH, true, ["deriveKey", "deriveBits"]);
export const exportRawPublicKey = async (key: CryptoKey): Promise<string> =>
  bytesToBase64(new Uint8Array(await subtle.exportKey("raw", key)));
export const importRawPublicKey = (b64: string): Promise<CryptoKey> =>
  subtle.importKey("raw", base64ToBytes(b64), ECDH, true, []);
export const importPrivateJwk = (jwk: JsonWebKey): Promise<CryptoKey> =>
  subtle.importKey("jwk", jwk, ECDH, true, ["deriveKey", "deriveBits"]);

export async function serializeKeyPair(
  pair: CryptoKeyPair,
): Promise<SerializedKeyPair> {
  const [pubB64, privJwk] = await Promise.all([
    exportRawPublicKey(pair.publicKey),
    subtle.exportKey("jwk", pair.privateKey),
  ]);
  return { pubB64, privJwk };
}

export async function ecdhDeriveBits(
  priv: CryptoKey,
  pub: CryptoKey,
): Promise<Bytes> {
  return new Uint8Array(
    await subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256),
  );
}

async function kdfRootKey(
  rootKey: Bytes,
  dhOutput: Bytes,
): Promise<[Bytes, Bytes]> {
  const ikm = await subtle.importKey("raw", dhOutput, "HKDF", false, [
    "deriveBits",
  ]);
  const derived = await subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: rootKey, info: RK_INFO },
    ikm,
    KEY_BYTES * 2 * 8,
  );
  const bytes = new Uint8Array(derived);

  return [
    new Uint8Array(bytes.subarray(0, KEY_BYTES)),
    new Uint8Array(bytes.subarray(KEY_BYTES, KEY_BYTES * 2)),
  ];
}

export async function kdfChainKey(chainKey: Bytes): Promise<[Bytes, Bytes]> {
  const hmac = await subtle.importKey(
    "raw",
    chainKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const [msgBuf, nextBuf] = await Promise.all([
    subtle.sign("HMAC", hmac, MSG_LABEL),
    subtle.sign("HMAC", hmac, CHAIN_LABEL),
  ]);

  return [new Uint8Array(nextBuf), new Uint8Array(msgBuf)];
}

const encodeHeaderAad = (h: RatchetHeader): Bytes =>
  new Uint8Array(new TextEncoder().encode(`${h.dhPub}|${h.n}|${h.pn}`));

export async function ratchetInitSender(
  sharedSecret: Bytes,
  remoteDhPubB64: string,
): Promise<RatchetState> {
  const localPair = await generateEcdhKeyPair();
  const remotePub = await importRawPublicKey(remoteDhPubB64);
  const dhOut = await ecdhDeriveBits(localPair.privateKey, remotePub);
  const [rootKey, sendChainKey] = await kdfRootKey(sharedSecret, dhOut);

  return {
    dhSelf: await serializeKeyPair(localPair),
    dhRemotePubB64: remoteDhPubB64,
    rootKeyB64: bytesToBase64(rootKey),
    sendChainKeyB64: bytesToBase64(sendChainKey),
    recvChainKeyB64: null,
    ns: 0,
    nr: 0,
    pn: 0,
    skipped: {},
  };
}

export async function ratchetInitReceiver(
  sharedSecret: Bytes,
  localDhKeyPair: CryptoKeyPair,
): Promise<RatchetState> {
  return {
    dhSelf: await serializeKeyPair(localDhKeyPair),
    dhRemotePubB64: null,
    rootKeyB64: bytesToBase64(sharedSecret),
    sendChainKeyB64: null,
    recvChainKeyB64: null,
    ns: 0,
    nr: 0,
    pn: 0,
    skipped: {},
  };
}

export async function ratchetEncrypt(
  state: RatchetState,
  plaintext: string,
): Promise<{
  state: RatchetState;
  header: RatchetHeader;
  iv: string;
  ct: string;
}> {
  if (!state.sendChainKeyB64) {
    throw new Error("Ratchet send chain is not initialized");
  }

  const [nextCk, msgKey] = await kdfChainKey(
    base64ToBytes(state.sendChainKeyB64),
  );
  const header: RatchetHeader = {
    dhPub: state.dhSelf.pubB64,
    n: state.ns,
    pn: state.pn,
  };
  const { iv, ct } = await aesGcmEncrypt(
    msgKey,
    plaintext,
    encodeHeaderAad(header),
  );

  return {
    state: {
      ...state,
      sendChainKeyB64: bytesToBase64(nextCk),
      ns: state.ns + 1,
      skipped: { ...state.skipped },
    },
    header,
    iv,
    ct,
  };
}

async function advanceSkippedKeys(
  recvChainKey: Bytes | null,
  dhRemotePubB64: string | null,
  fromN: number,
  untilN: number,
  skipped: Record<string, string>,
): Promise<{ nextChainKey: Bytes | null; nr: number }> {
  if (untilN - fromN > MAX_SKIP) {
    throw new Error("Exceeded MAX_SKIP for out-of-order messages");
  }

  let chainKey = recvChainKey;
  let nr = fromN;

  if (!chainKey || !dhRemotePubB64) return { nextChainKey: chainKey, nr };

  while (nr < untilN) {
    const [nextCk, msgKey] = await kdfChainKey(chainKey);

    skipped[`${dhRemotePubB64}:${nr}`] = bytesToBase64(msgKey);
    chainKey = nextCk;
    nr += 1;
  }

  return { nextChainKey: chainKey, nr };
}

export async function ratchetDecrypt(
  state: RatchetState,
  header: RatchetHeader,
  iv: string,
  ct: string,
): Promise<{ state: RatchetState; plaintext: string }> {
  const aad = encodeHeaderAad(header);
  const slot = `${header.dhPub}:${header.n}`;
  const skippedKeyB64 = state.skipped[slot];

  if (skippedKeyB64) {
    const nextSkipped = { ...state.skipped };

    delete nextSkipped[slot];
    const plaintext = await aesGcmDecrypt(
      base64ToBytes(skippedKeyB64),
      iv,
      ct,
      aad,
    );

    return { state: { ...state, skipped: nextSkipped }, plaintext };
  }

  let { dhSelf, dhRemotePubB64, ns, nr, pn } = state;
  let rootKey = base64ToBytes(state.rootKeyB64);
  let sendChainKey = state.sendChainKeyB64
    ? base64ToBytes(state.sendChainKeyB64)
    : null;
  let recvChainKey = state.recvChainKeyB64
    ? base64ToBytes(state.recvChainKeyB64)
    : null;
  const skipped = { ...state.skipped };

  if (header.dhPub !== dhRemotePubB64) {
    recvChainKey = (
      await advanceSkippedKeys(
        recvChainKey,
        dhRemotePubB64,
        nr,
        header.pn,
        skipped,
      )
    ).nextChainKey;
    [pn, ns, nr, dhRemotePubB64] = [ns, 0, 0, header.dhPub];

    const remotePub = await importRawPublicKey(dhRemotePubB64);
    const dhRecv = await ecdhDeriveBits(
      await importPrivateJwk(dhSelf.privJwk),
      remotePub,
    );
    [rootKey, recvChainKey] = await kdfRootKey(rootKey, dhRecv);

    const nextPair = await generateEcdhKeyPair();
    [rootKey, sendChainKey] = await kdfRootKey(
      rootKey,
      await ecdhDeriveBits(nextPair.privateKey, remotePub),
    );
    dhSelf = await serializeKeyPair(nextPair);
  }

  const skippedRes = await advanceSkippedKeys(
    recvChainKey,
    dhRemotePubB64,
    nr,
    header.n,
    skipped,
  );
  recvChainKey = skippedRes.nextChainKey;
  nr = skippedRes.nr;

  if (!recvChainKey)
    throw new Error("Ratchet receive chain is not initialized");

  const [nextRecvCk, msgKey] = await kdfChainKey(recvChainKey);
  const plaintext = await aesGcmDecrypt(msgKey, iv, ct, aad);

  return {
    state: {
      dhSelf,
      dhRemotePubB64,
      rootKeyB64: bytesToBase64(rootKey),
      sendChainKeyB64: sendChainKey ? bytesToBase64(sendChainKey) : null,
      recvChainKeyB64: bytesToBase64(nextRecvCk),
      ns,
      nr: nr + 1,
      pn,
      skipped,
    },
    plaintext,
  };
}

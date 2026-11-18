import { describe, expect, it } from "vitest";

import {
  computeSafetyNumber,
  decryptMediaBytes,
  encryptMediaBytes,
} from "@/lib/crypto/e2ee-media";
import {
  exportRawPublicKey,
  generateEcdhKeyPair,
  ratchetDecrypt,
  ratchetEncrypt,
  ratchetInitReceiver,
  ratchetInitSender,
} from "@/lib/crypto/e2ee-ratchet";
import {
  createMemoryRatchetStore,
  createSenderKeyState,
  decryptGroupMessage,
  deriveInitialSharedSecret,
  deriveResponderSharedSecret,
  encryptGroupMessage,
  isV2Wire,
  parseV2Envelope,
  parseV2GroupEnvelope,
  serializeV2Envelope,
  serializeV2GroupEnvelope,
  V2_PREFIX,
  V2G_PREFIX,
} from "@/lib/crypto/e2ee-v2";

async function setupPairwiseRatchet() {
  const aliceId = await generateEcdhKeyPair();
  const bobId = await generateEcdhKeyPair();
  const bobPrekey = await generateEcdhKeyPair();
  const bobRatchetKey = await generateEcdhKeyPair();

  const ssAlice = await deriveInitialSharedSecret(
    aliceId.privateKey,
    bobId.publicKey,
    bobPrekey.publicKey,
  );
  const ssBob = await deriveResponderSharedSecret(
    bobId.privateKey,
    bobPrekey.privateKey,
    aliceId.publicKey,
  );

  expect(ssAlice).toEqual(ssBob);

  const bobDhPub = await exportRawPublicKey(bobRatchetKey.publicKey);
  const aliceState = await ratchetInitSender(ssAlice, bobDhPub);
  const bobState = await ratchetInitReceiver(ssBob, bobRatchetKey);

  return { aliceState, bobState, aliceId, bobId };
}

describe("e2ee-v2 crypto engine", () => {
  it("supports multi-turn Double Ratchet ping-pong", async () => {
    let { aliceState, bobState } = await setupPairwiseRatchet();

    const m1 = await ratchetEncrypt(aliceState, "hello bob 1");
    aliceState = m1.state;
    const d1 = await ratchetDecrypt(bobState, m1.header, m1.iv, m1.ct);
    bobState = d1.state;
    expect(d1.plaintext).toBe("hello bob 1");

    const m2 = await ratchetEncrypt(bobState, "hi alice 1");
    bobState = m2.state;
    const d2 = await ratchetDecrypt(aliceState, m2.header, m2.iv, m2.ct);
    aliceState = d2.state;
    expect(d2.plaintext).toBe("hi alice 1");

    const m3 = await ratchetEncrypt(aliceState, "turn 2 from alice");
    aliceState = m3.state;
    const m4 = await ratchetEncrypt(aliceState, "turn 2 second msg");
    aliceState = m4.state;

    const d3 = await ratchetDecrypt(bobState, m3.header, m3.iv, m3.ct);
    bobState = d3.state;
    const d4 = await ratchetDecrypt(bobState, m4.header, m4.iv, m4.ct);
    expect(d3.plaintext).toBe("turn 2 from alice");
    expect(d4.plaintext).toBe("turn 2 second msg");
  });

  it("decrypts out-of-order messages via skipped message keys", async () => {
    let { aliceState, bobState } = await setupPairwiseRatchet();

    const m1 = await ratchetEncrypt(aliceState, "msg-0");
    aliceState = m1.state;
    const m2 = await ratchetEncrypt(aliceState, "msg-1");
    aliceState = m2.state;
    const m3 = await ratchetEncrypt(aliceState, "msg-2");

    // Bob receives msg-2 first, then msg-0, then msg-1.
    const d3 = await ratchetDecrypt(bobState, m3.header, m3.iv, m3.ct);
    bobState = d3.state;
    expect(d3.plaintext).toBe("msg-2");

    const d1 = await ratchetDecrypt(bobState, m1.header, m1.iv, m1.ct);
    bobState = d1.state;
    expect(d1.plaintext).toBe("msg-0");

    const d2 = await ratchetDecrypt(bobState, m2.header, m2.iv, m2.ct);
    expect(d2.plaintext).toBe("msg-1");
  });

  it("enforces forward secrecy across messages and turns", async () => {
    const initial = await setupPairwiseRatchet();
    const staleBobState = structuredClone(initial.bobState);

    let aliceState = initial.aliceState;
    let bobState = initial.bobState;

    const m1 = await ratchetEncrypt(aliceState, "first");
    aliceState = m1.state;
    const d1 = await ratchetDecrypt(bobState, m1.header, m1.iv, m1.ct);
    bobState = d1.state;

    // Bob replies, triggering a DH ratchet step when Alice receives it.
    const reply = await ratchetEncrypt(bobState, "reply");
    const dReply = await ratchetDecrypt(
      aliceState,
      reply.header,
      reply.iv,
      reply.ct,
    );
    aliceState = dReply.state;

    const future = await ratchetEncrypt(aliceState, "future secret");

    // Stale Bob state from before the DH ratchet cannot decrypt future turn.
    await expect(
      ratchetDecrypt(staleBobState, future.header, future.iv, future.ct),
    ).rejects.toThrow();

    // Replaying already consumed message fails.
    await expect(
      ratchetDecrypt(bobState, m1.header, m1.iv, m1.ct),
    ).rejects.toThrow();
  });

  it("supports Group Sender Keys sequentially and out-of-order", async () => {
    const senderInit = createSenderKeyState("dev-alice");
    let sender = senderInit;
    let memberBob = structuredClone(senderInit);
    let memberCara = structuredClone(senderInit);

    const g1 = await encryptGroupMessage(sender, "group-0");
    sender = g1.state;
    const g2 = await encryptGroupMessage(sender, "group-1");
    sender = g2.state;
    const g3 = await encryptGroupMessage(sender, "group-2");

    // Bob decrypts in order.
    const b1 = await decryptGroupMessage(memberBob, g1.envelope);
    memberBob = b1.state;
    const b2 = await decryptGroupMessage(memberBob, g2.envelope);
    memberBob = b2.state;
    const b3 = await decryptGroupMessage(memberBob, g3.envelope);
    expect([b1.plaintext, b2.plaintext, b3.plaintext]).toEqual([
      "group-0",
      "group-1",
      "group-2",
    ]);

    // Cara receives g3 before g1 and g2.
    const c3 = await decryptGroupMessage(memberCara, g3.envelope);
    memberCara = c3.state;
    const c1 = await decryptGroupMessage(memberCara, g1.envelope);
    memberCara = c1.state;
    const c2 = await decryptGroupMessage(memberCara, g2.envelope);
    expect([c3.plaintext, c1.plaintext, c2.plaintext]).toEqual([
      "group-2",
      "group-0",
      "group-1",
    ]);
  });

  it("encrypts/decrypts media bytes and rejects tampered payloads", async () => {
    const raw = new TextEncoder().encode("binary-voice-note-payload-12345");
    const enc = await encryptMediaBytes(raw);
    const dec = await decryptMediaBytes(
      enc.encryptedBytes,
      enc.keyB64,
      enc.ivB64,
      enc.sha256B64,
    );

    expect(dec).toEqual(raw);

    const tampered = new Uint8Array(enc.encryptedBytes);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;

    await expect(
      decryptMediaBytes(tampered, enc.keyB64, enc.ivB64, enc.sha256B64),
    ).rejects.toThrow();

    await expect(
      decryptMediaBytes(enc.encryptedBytes, enc.keyB64, enc.ivB64, "AAAA"),
    ).rejects.toThrow();
  });

  it("computes deterministic symmetric 60-digit safety numbers", async () => {
    const a = await generateEcdhKeyPair();
    const b = await generateEcdhKeyPair();
    const pubA = await exportRawPublicKey(a.publicKey);
    const pubB = await exportRawPublicKey(b.publicKey);

    const snAB = await computeSafetyNumber(pubA, pubB);
    const snBA = await computeSafetyNumber(pubB, pubA);

    expect(snAB).toBe(snBA);
    expect(snAB).toMatch(/^(\d{5} ){11}\d{5}$/);
    expect(snAB.replace(/\s/g, "")).toHaveLength(60);
  });

  it("serializes wire envelopes and persists state in memory store", async () => {
    const dmWire = serializeV2Envelope({
      v: 2,
      envelopes: {
        "dev-2": {
          senderDeviceId: "dev-1",
          dhPub: "pub",
          n: 0,
          pn: 0,
          iv: "iv",
          ct: "ct",
        },
      },
    });
    expect(dmWire.startsWith(V2_PREFIX)).toBe(true);
    expect(isV2Wire(dmWire)).toBe(true);
    expect(parseV2Envelope(dmWire)?.envelopes["dev-2"]?.ct).toBe("ct");

    const grpWire = serializeV2GroupEnvelope({
      v: 2,
      senderDeviceId: "dev-1",
      keyId: "k1",
      iteration: 0,
      iv: "iv",
      ct: "ct",
    });
    expect(grpWire.startsWith(V2G_PREFIX)).toBe(true);
    expect(isV2Wire(grpWire)).toBe(true);
    expect(parseV2GroupEnvelope(grpWire)?.keyId).toBe("k1");

    const store = createMemoryRatchetStore();
    const sk = createSenderKeyState("dev-1");
    await store.setSenderKey("conv-1:dev-1", sk);
    expect(await store.getSenderKey("conv-1:dev-1")).toEqual(sk);
    await store.deleteSenderKey("conv-1:dev-1");
    expect(await store.getSenderKey("conv-1:dev-1")).toBeNull();
  });

  it("derives identical X3DH shared secrets when sender uses an ephemeral prekey", async () => {
    const aliceId = await generateEcdhKeyPair();
    const aliceEph = await generateEcdhKeyPair();
    const bobId = await generateEcdhKeyPair();
    const bobSpk = await generateEcdhKeyPair();

    const ssAlice = await deriveInitialSharedSecret(
      aliceId.privateKey,
      bobId.publicKey,
      bobSpk.publicKey,
      aliceEph.privateKey,
    );
    const ssBob = await deriveResponderSharedSecret(
      bobId.privateKey,
      bobSpk.privateKey,
      aliceId.publicKey,
      aliceEph.publicKey,
    );

    expect(ssAlice).toEqual(ssBob);

    const bobRatchetKey = await generateEcdhKeyPair();
    const aliceState = await ratchetInitSender(
      ssAlice,
      await exportRawPublicKey(bobRatchetKey.publicKey),
    );
    const bobState = await ratchetInitReceiver(ssBob, bobRatchetKey);
    const encrypted = await ratchetEncrypt(aliceState, "x3dh-ephemeral-ok");
    const envWire = serializeV2Envelope({
      v: 2,
      envelopes: {
        "dev-bob": {
          senderDeviceId: "dev-alice",
          dhPub: encrypted.header.dhPub,
          n: encrypted.header.n,
          pn: encrypted.header.pn,
          iv: encrypted.iv,
          ct: encrypted.ct,
          senderEphemeralPublicKey: await exportRawPublicKey(
            aliceEph.publicKey,
          ),
        },
      },
    });
    const parsedEnv = parseV2Envelope(envWire)?.envelopes["dev-bob"];

    expect(parsedEnv?.senderEphemeralPublicKey).toBeTruthy();

    const decrypted = await ratchetDecrypt(
      bobState,
      {
        dhPub: parsedEnv!.dhPub,
        n: parsedEnv!.n,
        pn: parsedEnv!.pn,
      },
      parsedEnv!.iv,
      parsedEnv!.ct,
    );

    expect(decrypted.plaintext).toBe("x3dh-ephemeral-ok");
  });
});

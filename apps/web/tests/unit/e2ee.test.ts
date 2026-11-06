import { describe, expect, it } from "vitest";

import {
  buildAad,
  decryptWithDataKey,
  decryptWithKeyPair,
  encryptWithDataKey,
  encryptWithKeyPair,
  exportPublicKey,
  generateDataKey,
  generateKeyPair,
  importKeyPairFromJwk,
  isValidWireFormat,
  parseWireFormat,
  unwrapDataKey,
  wrapDataKey,
} from "@/lib/crypto/e2ee";
import { isCiphertextWireFormat } from "@/lib/db/direct-messages";

describe("e2ee wire format", () => {
  it("parses iv:ciphertext into bytes", async () => {
    const sender = await generateKeyPair();
    const receiver = await generateKeyPair();
    const senderPublic = await exportPublicKey(sender);
    const receiverPublic = await exportPublicKey(receiver);
    const wire = await encryptWithKeyPair(sender, receiverPublic, "hello");
    const parsed = parseWireFormat(wire);

    expect(parsed).not.toBeNull();
    expect(isValidWireFormat(wire)).toBe(true);
    expect(senderPublic).not.toBe(receiverPublic);
  });

  it("roundtrips plaintext between two keypairs", async () => {
    const sender = await generateKeyPair();
    const receiver = await generateKeyPair();
    const receiverPublic = await exportPublicKey(receiver);
    const senderPublic = await exportPublicKey(sender);
    const wire = await encryptWithKeyPair(
      sender,
      receiverPublic,
      "Hello encrypted world!",
    );
    const plaintext = await decryptWithKeyPair(receiver, senderPublic, wire);

    expect(plaintext).toBe("Hello encrypted world!");
    expect(wire).not.toContain("Hello");
  });

  it("rejects malformed wire formats", () => {
    expect(parseWireFormat("no-colon")).toBeNull();
    expect(parseWireFormat(":cipher")).toBeNull();
    expect(parseWireFormat("a:b:c")).toBeNull();
    expect(isValidWireFormat("not-base64!:also-bad!")).toBe(false);
  });
});

describe("isCiphertextWireFormat", () => {
  it("accepts a single-colon wire and rejects colon abuse", () => {
    expect(isCiphertextWireFormat("abc:def")).toBe(true);
    expect(isCiphertextWireFormat("abc")).toBe(false);
    expect(isCiphertextWireFormat("a:b:c")).toBe(false);
    expect(isCiphertextWireFormat("")).toBe(false);
  });
});

describe("importKeyPairFromJwk", () => {
  it("rebuilds a working keypair from exported JWK parts", async () => {
    const pair = await generateKeyPair();
    const senderPublic = await exportPublicKey(pair);
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

    const restored = await importKeyPairFromJwk(jwk);
    const restoredPublic = await exportPublicKey(restored);

    // The restored keypair derives the identical shared secret.
    const receiver = await generateKeyPair();
    const receiverPublic = await exportPublicKey(receiver);
    const wire = await encryptWithKeyPair(restored, receiverPublic, "hi");
    const plaintext = await decryptWithKeyPair(receiver, senderPublic, wire);

    expect(restoredPublic).toBe(senderPublic);
    expect(plaintext).toBe("hi");
  });

  it("rejects a JWK missing its public parts", async () => {
    await expect(
      importKeyPairFromJwk({ kty: "EC" } as unknown as JsonWebKey),
    ).rejects.toThrow();
  });
});

describe("AAD-bound v2 messages", () => {
  it("roundtrips with matching context", async () => {
    const sender = await generateKeyPair();
    const receiver = await generateKeyPair();
    const receiverPublic = await exportPublicKey(receiver);
    const senderPublic = await exportPublicKey(sender);
    const wire = await encryptWithKeyPair(
      sender,
      receiverPublic,
      "bound message",
      buildAad("conv-1", "sender-1"),
    );

    expect(wire.startsWith("v2:")).toBe(true);

    const plaintext = await decryptWithKeyPair(
      receiver,
      senderPublic,
      wire,
      buildAad("conv-1", "sender-1"),
    );

    expect(plaintext).toBe("bound message");
  });

  it("rejects decryption in a different conversation context", async () => {
    const sender = await generateKeyPair();
    const receiver = await generateKeyPair();
    const receiverPublic = await exportPublicKey(receiver);
    const wire = await encryptWithKeyPair(
      sender,
      receiverPublic,
      "bound message",
      buildAad("conv-1", "sender-1"),
    );

    await expect(
      decryptWithKeyPair(
        receiver,
        await exportPublicKey(sender),
        wire,
        buildAad("conv-2", "sender-1"),
      ),
    ).rejects.toThrow();
  });

  it("rejects v2 decryption without context", async () => {
    const sender = await generateKeyPair();
    const receiver = await generateKeyPair();
    const receiverPublic = await exportPublicKey(receiver);
    const wire = await encryptWithKeyPair(
      sender,
      receiverPublic,
      "bound message",
      buildAad("conv-1", "sender-1"),
    );

    await expect(
      decryptWithKeyPair(
        receiver,
        await exportPublicKey(sender),
        wire,
        undefined,
      ),
    ).rejects.toThrow();
  });
});

describe("group per-recipient envelopes", () => {
  it("lets every member unwrap the same data key and decrypt", async () => {
    const sender = await generateKeyPair();
    const memberA = await generateKeyPair();
    const memberB = await generateKeyPair();
    const memberAPublic = await exportPublicKey(memberA);
    const memberBPublic = await exportPublicKey(memberB);

    const dataKey = await generateDataKey();
    const wire = await encryptWithDataKey(
      dataKey,
      "hello group",
      buildAad("group-1", "sender-1"),
    );

    // Envelopes are wrapped for each member by the sender. Unwrapping uses
    // the member's own pair against the sender's public key.
    const wrapA = await wrapDataKey(sender, memberAPublic, dataKey);
    const wrapB = await wrapDataKey(sender, memberBPublic, dataKey);

    for (const [pair, wrap] of [
      [memberA, wrapA],
      [memberB, wrapB],
    ] as const) {
      const unwrapped = await unwrapDataKey(
        pair,
        await exportPublicKey(sender),
        wrap,
      );
      const plaintext = await decryptWithDataKey(
        unwrapped,
        wire,
        buildAad("group-1", "sender-1"),
      );
      expect(plaintext).toBe("hello group");
    }
  });

  it("rejects unwrapping with the wrong private key", async () => {
    const sender = await generateKeyPair();
    const memberA = await generateKeyPair();
    const memberB = await generateKeyPair();
    const dataKey = await generateDataKey();
    const wrapA = await wrapDataKey(
      sender,
      await exportPublicKey(memberA),
      dataKey,
    );

    await expect(
      unwrapDataKey(memberB, await exportPublicKey(sender), wrapA),
    ).rejects.toThrow();
  });
});

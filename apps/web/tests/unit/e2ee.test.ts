import { describe, expect, it } from "vitest";

import {
  decryptWithKeyPair,
  encryptWithKeyPair,
  exportPublicKey,
  generateKeyPair,
  importKeyPairFromJwk,
  isValidWireFormat,
  parseWireFormat,
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

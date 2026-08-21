import { describe, it, expect, beforeAll } from "vitest";
import {
  generateKeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
  hashDocument,
  signHash,
  verifySignature,
} from "../src/services/cryptoService.js";

beforeAll(() => {
  // Ensure deterministic encryption key for tests
  process.env.BETTER_AUTH_SECRET = "test-secret-for-crypto-service-123";
});

describe("cryptoService", () => {
  it("generates a key pair with PEM formatted keys", () => {
    const { publicKey, privateKey } = generateKeyPair();
    expect(publicKey).toMatch(/BEGIN PUBLIC KEY/);
    expect(privateKey).toMatch(/BEGIN PRIVATE KEY/);
  });

  it("hashDocument is deterministic and changes for different input", () => {
    const a = Buffer.from("hello world");
    const b = Buffer.from("hello world");
    const c = Buffer.from("goodbye world");

    const ha = hashDocument(a);
    const hb = hashDocument(b);
    const hc = hashDocument(c);

    expect(ha).toBe(hb);
    expect(ha).not.toBe(hc);
  });

  it("signs a hash and verifies correctly; detects tampering and wrong keys", () => {
    const { publicKey, privateKey } = generateKeyPair();
    const other = generateKeyPair();

    const data = Buffer.from("important document content");
    const h = hashDocument(data);

    const signature = signHash(h, privateKey);
    expect(typeof signature).toBe("string");

    // Valid verification
    expect(verifySignature(h, signature, publicKey)).toBe(true);

    // Tampered data fails
    const tamperedHash = hashDocument(Buffer.from("tampered content"));
    expect(verifySignature(tamperedHash, signature, publicKey)).toBe(false);

    // Wrong public key fails
    expect(verifySignature(h, signature, other.publicKey)).toBe(false);

    // Modified signature fails — flip a bit in the signature bytes to ensure it's invalid
    const sigBuf = Buffer.from(signature, "base64");
    sigBuf[0] = sigBuf[0] ^ 0xff;
    const modifiedSig = sigBuf.toString("base64");
    expect(verifySignature(h, modifiedSig, publicKey)).toBe(false);
  });

  it("encrypts and decrypts a private key and fails on tampering", () => {
    const { privateKey } = generateKeyPair();

    const encrypted = encryptPrivateKey(privateKey);
    expect(typeof encrypted).toBe("string");

    const decrypted = decryptPrivateKey(encrypted);
    expect(decrypted).toContain("BEGIN PRIVATE KEY");

    // Tamper with encrypted payload -> decryption should throw or produce invalid result
    const tampered = encrypted.slice(0, -5) + "aaaaa";
    expect(() => decryptPrivateKey(tampered)).toThrow();
  });
});

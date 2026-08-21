import crypto from "crypto";

// Derive a 32-byte key from the BETTER_AUTH_SECRET env var
const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(
    process.env.BETTER_AUTH_SECRET ||
      "default-secret-key-replace-in-prod-12345",
  )
  .digest();

export function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
  console.log("Public key:", publicKey);
  console.log("Private key:", privateKey);
  return { publicKey, privateKey };
}

export function encryptPrivateKey(privateKeyPem: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    ENCRYPTION_KEY as any,
    iv as any,
  );
  let encrypted = cipher.update(privateKeyPem, "utf8", "hex");
  encrypted += cipher.final("hex");
  // Store iv alongside encrypted data as iv:encryptedData
  return `${iv.toString("hex")}:${encrypted}`;
}

export function decryptPrivateKey(encryptedPrivateKey: string): string {
  const parts = encryptedPrivateKey.split(":");
  const ivHex = parts.shift() || "";
  const encryptedText = parts.join(":");

  const iv = Buffer.from(ivHex, "hex");
  const encryptedBuffer = Buffer.from(encryptedText, "hex");

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    ENCRYPTION_KEY as any,
    iv as any,
  );
  const decrypted1 = decipher.update(encryptedBuffer as any);
  const decrypted2 = decipher.final();

  return Buffer.concat([decrypted1 as any, decrypted2 as any]).toString("utf8");
}

export function hashDocument(data: Buffer): string {
  return crypto
    .createHash("sha256")
    .update(data as any)
    .digest("hex");
}

export function signHash(hash: string, privateKeyPem: string): string {
  const sign = crypto.createSign("SHA256");
  sign.update(hash);
  return sign.sign(privateKeyPem, "base64");
}

export function verifySignature(
  hash: string,
  signature: string,
  publicKeyPem: string,
): boolean {
  const verify = crypto.createVerify("SHA256");
  verify.update(hash);
  return verify.verify(publicKeyPem, signature, "base64");
}

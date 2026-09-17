import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) throw new Error("APP_SECRET is not set");
  return createHash("sha256").update(secret).digest();
}

/** AES-256-GCM. Output: base64(iv | tag | ciphertext). Used for user-supplied API keys at rest. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function hasAppSecret(): boolean {
  return Boolean(process.env.APP_SECRET && process.env.APP_SECRET.length >= 16);
}

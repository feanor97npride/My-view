import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const secret = process.env.PREFS_ENCRYPTION_KEY?.trim() || process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) return null;
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const clean = plaintext.trim();
  if (!clean) return "";
  const key = getKey();
  if (!key) return clean;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(clean, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecret(stored: string): string {
  const val = stored.trim();
  if (!val) return "";
  if (!val.startsWith(PREFIX)) return val; // backward compatibility with legacy plaintext rows
  const key = getKey();
  if (!key) return "";
  const parts = val.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return "";
  try {
    const iv = Buffer.from(parts[0], "base64url");
    const tag = Buffer.from(parts[1], "base64url");
    const data = Buffer.from(parts[2], "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8").trim();
  } catch {
    return "";
  }
}

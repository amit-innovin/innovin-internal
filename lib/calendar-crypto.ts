import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Admins' Google refresh tokens at rest: AES-256-GCM under CALENDAR_TOKEN_KEY (32 bytes, base64 or
// hex). The admin's email is bound in as associated data, so a row copied onto another admin won't
// open; `kid` names the key, so rows sealed under an old key read as "reconnect", not garbage.
export type Sealed = { ciphertext: string; iv: string; tag: string; kid: string };

export function tokenKey(): Buffer | null {
  const raw = process.env.CALENDAR_TOKEN_KEY?.trim();
  if (!raw) return null;
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

const kidOf = (key: Buffer) => createHash("sha256").update(key).digest("hex").slice(0, 12);
const aad = (email: string) => Buffer.from(`calendar-token:${email.toLowerCase()}`);

export function sealToken(email: string, token: string): Sealed | null {
  const key = tokenKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(email));
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), kid: kidOf(key) };
}

export function unsealToken(email: string, sealed: Sealed): string | null {
  const key = tokenKey();
  if (!key || sealed.kid !== kidOf(key)) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
    decipher.setAAD(aad(email));
    decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

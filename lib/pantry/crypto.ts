import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export function encryptionReady() { return /^[a-f\d]{64}$/i.test(process.env.PANTRY_INTEGRATION_KEY ?? ""); }
function key() {
  if (!encryptionReady()) throw new Error("Pantry purchasing needs a dedicated 32-byte encryption key");
  return Buffer.from(process.env.PANTRY_INTEGRATION_KEY!, "hex");
}
export function seal(value: unknown, purpose: "record" | "oauth") {
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), nonce);
  cipher.setAAD(Buffer.from(`innovin-pantry:v1:${purpose}`));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const encoded = ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
  if (encoded.length > 1_500_000) throw new Error("Purchasing state is too large to save safely");
  return encoded;
}
export function unseal<T>(value: string, purpose: "record" | "oauth"): T {
  if (value.length > 1_500_000) throw new Error("Invalid purchasing state");
  const [version, nonce, tag, data, extra] = value.split(".");
  if (version !== "v1" || !nonce || !tag || !data || extra) throw new Error("Invalid purchasing state");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(nonce, "base64url"));
  decipher.setAAD(Buffer.from(`innovin-pantry:v1:${purpose}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")) as T;
}

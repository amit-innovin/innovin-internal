import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { seal, unseal } from "./crypto";
import { PantryError } from "./swiggy";
export const PANTRY_OAUTH_COOKIE = "innovin_pantry_oauth";
export type PendingOAuth = { state: string; verifier: string; clientId: string; actor: string; expiresAt: number; version: number | null; redirectUri: string };
export function callbackUri(origin: string) {
  const base = new URL(origin);
  const local = ["localhost", "127.0.0.1"].includes(base.hostname);
  const configured = process.env.PANTRY_SWIGGY_REDIRECT_URI;
  if (!configured && !local) throw new PantryError("Configure and register the production Instamart callback URL first", 503);
  const url = new URL(configured || "/api/pantry-provider/callback", base);
  if (url.origin !== base.origin || url.pathname !== "/api/pantry-provider/callback" || url.search || url.hash || url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) throw new PantryError("Invalid Instamart callback configuration", 503);
  return url.href;
}
export function pendingOAuth(actor: string, clientId: string, redirectUri: string, version: number | null) {
  const pending: PendingOAuth = { state: randomBytes(32).toString("base64url"), verifier: randomBytes(48).toString("base64url"), actor, clientId, redirectUri, version, expiresAt: Date.now()+600000 };
  return { pending, cookie: seal(pending, "oauth"), challenge: createHash("sha256").update(pending.verifier).digest("base64url") };
}
export function verifyPending(cookie: string | undefined, state: string | null, actor: string): PendingOAuth {
  try {
    if (!cookie || !state || state.length > 200) throw new Error();
    const p = unseal<PendingOAuth>(cookie, "oauth");
    const a = Buffer.from(state), b = Buffer.from(p.state);
    if (a.length !== b.length || !timingSafeEqual(a,b) || p.actor !== actor || p.expiresAt < Date.now() || p.expiresAt > Date.now()+600000) throw new Error();
    return p;
  } catch { throw new PantryError("Instamart connection expired or changed. Start connecting again.", 400); }
}

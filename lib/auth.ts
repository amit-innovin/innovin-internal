import crypto from "crypto";
import { cookies } from "next/headers";

// Signed-in employee identity. The cookie is HMAC-signed with SESSION_SECRET (falling back to
// ADMIN_PASSCODE so local dev needs no extra env) and expires after 30 days.
export const USER_COOKIE = "innovin_user";
export const USER_SESSION_MS = 30 * 24 * 60 * 60_000;
export const OAUTH_COOKIE = "innovin_oauth";
const OAUTH_STATE_MS = 10 * 60_000;

const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSCODE;

const b64u = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const hmac = (key: string, value: string) => crypto.createHmac("sha256", key).update(value).digest("hex");
const equal = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export type UserSession = { email: string; name: string };

export function createUserSession(user: UserSession, now = Date.now()) {
  const key = secret();
  if (!key) return null;
  const payload = b64u(JSON.stringify({ e: user.email, n: user.name, i: now }));
  return `${payload}.${hmac(key, `innovin-user-v1:${payload}`)}`;
}

export function verifyUserSession(token: string | undefined, now = Date.now()): UserSession | null {
  const key = secret();
  if (!key || !token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  if (!equal(token.slice(dot + 1), hmac(key, `innovin-user-v1:${payload}`))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { e?: unknown; n?: unknown; i?: unknown };
    if (typeof parsed.e !== "string" || typeof parsed.n !== "string" || typeof parsed.i !== "number") return null;
    if (parsed.i > now + 60_000 || now - parsed.i > USER_SESSION_MS) return null;
    return { email: parsed.e, name: parsed.n };
  } catch {
    return null;
  }
}

export async function currentUser() {
  return verifyUserSession((await cookies()).get(USER_COOKIE)?.value);
}

// OAuth CSRF state: cookie holds "<iat>.<nonce>.<sig>", the state param is "<nonce>.<base64url(next)>".
export function createOauthState(next: string, now = Date.now()) {
  const nonce = crypto.randomUUID();
  const sig = hmac(secret()!, `innovin-oauth-state:${now}:${nonce}`);
  return { cookie: `${now}.${nonce}.${sig}`, state: `${nonce}.${b64u(next)}` };
}

export function verifyOauthState(cookie: string | undefined, state: string | null, now = Date.now()) {
  const key = secret();
  if (!key || !cookie || !state) return null;
  const [iat, nonce, sig] = cookie.split(".");
  const issued = Number(iat);
  if (!Number.isFinite(issued) || !nonce || !sig || now - issued > OAUTH_STATE_MS) return null;
  if (!equal(sig, hmac(key, `innovin-oauth-state:${iat}:${nonce}`))) return null;
  const dot = state.indexOf(".");
  if (dot < 0 || state.slice(0, dot) !== nonce) return null;
  try {
    const next = Buffer.from(state.slice(dot + 1), "base64url").toString("utf8");
    return next.startsWith("/") && !next.startsWith("//") ? next : "/";
  } catch {
    return "/";
  }
}

export const sanitizeNext = (next: string | null) => (next?.startsWith("/") && !next.startsWith("//") ? next : "/");

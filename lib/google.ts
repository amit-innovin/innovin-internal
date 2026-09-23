import { allowedEmailDomains } from "./config";

// Google OAuth (authorization-code flow). Endpoints are env-overridable so e2e can point them at
// a mock — production uses the real Google endpoints.
const authEndpoint = () => process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = () => process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const tokeninfoEndpoint = () => process.env.GOOGLE_TOKENINFO_URL || "https://oauth2.googleapis.com/tokeninfo";

export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function googleAuthUrl(redirectUri: string, state: string) {
  const url = new URL(authEndpoint());
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  const domain = allowedEmailDomains()[0];
  if (domain) url.searchParams.set("hd", domain); // UX hint; the domain is verified server-side
  return url.toString();
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id_token?: unknown };
  return typeof data.id_token === "string" ? data.id_token : null;
}

export type GoogleIdentity = { email: string; name: string; picture: string };

// Validates the id_token via Google's tokeninfo endpoint (signature + expiry checked by Google),
// then enforces our own checks: correct audience, verified email on an allowed domain.
export async function verifyIdToken(idToken: string): Promise<GoogleIdentity | null> {
  const res = await fetch(`${tokeninfoEndpoint()}?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) return null;
  const t = (await res.json()) as Record<string, unknown>;
  if (t.aud !== process.env.GOOGLE_CLIENT_ID) return null;
  if (t.email_verified !== true && t.email_verified !== "true") return null;
  const exp = Number(t.exp);
  if (Number.isFinite(exp) && exp * 1000 < Date.now()) return null;
  const email = String(t.email ?? "").toLowerCase();
  const domain = email.split("@")[1] ?? "";
  if (!email || !allowedEmailDomains().includes(domain)) return null;
  return { email, name: String(t.name || email.split("@")[0]), picture: String(t.picture || "") };
}

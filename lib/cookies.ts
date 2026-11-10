export const EMAIL_COOKIE = "innovin_email";
export const DEVICE_COOKIE = "innovin_device";
// IDs of grievances submitted from this browser — the ONLY place a device↔grievance
// link exists. The server stores a constant "anon" ref, so the DB can't be joined
// against away to de-anonymize anyone.
export const GRIEVANCE_IDS_COOKIE = "innovin_grv";
// When this browser last opened the notification feed — drives the unread count. A cookie, so
// it works without signing in and needs no schema.
export const NOTIFICATIONS_SEEN_COOKIE = "innovin_seen";

export const longLivedCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
  path: "/",
};

// Production builds also run as HTTP localhost previews. Safari does not retain Secure
// cookies on that transport. Only exact loopback hosts may use an insecure auth cookie.
export function secureAuthCookie(origin: string) {
  const url = new URL(origin);
  return url.protocol === "https:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

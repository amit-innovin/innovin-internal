export const EMAIL_COOKIE = "innovin_email";
export const DEVICE_COOKIE = "innovin_device";
// IDs of grievances submitted from this browser — the ONLY place a device↔grievance
// link exists. The server stores a constant "anon" ref, so the DB can't be joined
// against away/orders to de-anonymize anyone.
export const GRIEVANCE_IDS_COOKIE = "innovin_grv";

export const longLivedCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
  path: "/",
};

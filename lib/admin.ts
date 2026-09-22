import { cookies } from "next/headers";
import crypto from "crypto";
import { ADMIN_SESSION_MS } from "./config";

export const ADMIN_COOKIE = "innovin_admin";

const sign = (passcode: string, issuedAt: number) =>
  crypto.createHmac("sha256", passcode).update(`innovin-admin-session-v2:${issuedAt}`).digest("hex");

const equal = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export function validAdminPasscode(candidate: unknown) {
  const expected = process.env.ADMIN_PASSCODE;
  return typeof candidate === "string" && !!expected && equal(candidate, expected);
}

// Session token = "<issuedAt>.<hmac>". Expires server-side after ADMIN_SESSION_MS and is
// invalidated for everyone when ADMIN_PASSCODE changes.
export function createAdminSession(now = Date.now()) {
  return `${now}.${sign(process.env.ADMIN_PASSCODE!, now)}`;
}

export function verifyAdminSession(token: string | undefined, now = Date.now()) {
  const passcode = process.env.ADMIN_PASSCODE;
  if (!passcode || !token) return false;
  const [issued, mac] = token.split(".");
  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt) || !mac || issuedAt > now + 60_000 || now - issuedAt > ADMIN_SESSION_MS) return false;
  return equal(mac, sign(passcode, issuedAt));
}

export async function isAdmin() {
  return verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
}

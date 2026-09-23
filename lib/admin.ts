import { cookies } from "next/headers";
import crypto from "crypto";
import { currentUser } from "./auth";
import { ADMIN_SESSION_MS } from "./config";
import { store } from "./store";
import type { Role } from "./types";

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

// Two ways to hold admin powers:
//   1. A verified Google identity whose directory role is admin/owner — the everyday path,
//      and the only one that can be attributed to a person or revoked individually.
//   2. The shared ADMIN_PASSCODE ("break-glass") — kept for bootstrap and for when Google
//      sign-in is unavailable. It carries no identity, so its actions can't be attributed.
export type Actor = { email: string; name: string; role: Role };

export async function currentActor(): Promise<Actor | null> {
  const user = await currentUser();
  if (!user) return null;
  const row = await store.getEmployee(user.email);
  return { email: user.email, name: user.name, role: row?.role ?? "member" };
}

async function hasPin() {
  return verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function isAdmin() {
  if (await hasPin()) return true;
  const role = (await currentActor())?.role;
  return role === "admin" || role === "owner";
}

// Granting/revoking admin is owner-only. The break-glass PIN also qualifies, otherwise an
// org with no owner yet (or a lost owner account) could never appoint one.
export async function isOwner() {
  if (await hasPin()) return true;
  return (await currentActor())?.role === "owner";
}

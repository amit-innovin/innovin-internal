import { cookies } from "next/headers";
import crypto from "crypto";

export const ADMIN_COOKIE = "innovin_admin";

const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export const adminCookieValue = () => hash(process.env.ADMIN_PASSCODE!);

export async function isAdmin() {
  const pass = process.env.ADMIN_PASSCODE;
  if (!pass) return false;
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!value && value === adminCookieValue();
}

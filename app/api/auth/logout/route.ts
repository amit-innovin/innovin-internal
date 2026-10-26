import { store } from "@/lib/store";
import { cookies } from "next/headers";
import { pushSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { USER_COOKIE } from "@/lib/auth";

export async function POST() {
  const binding = pushSession((await cookies()).get(USER_COOKIE)?.value);
  if (binding) await store.revokePushSession(binding.sessionRef).catch(() => console.warn("[push] Session revocation failed; local identity still cleared"));
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(USER_COOKIE);
  return res;
}

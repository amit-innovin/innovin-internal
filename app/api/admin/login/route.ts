import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieValue } from "@/lib/admin";

export async function POST(req: Request) {
  const { passcode } = await req.json();
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected || passcode !== expected) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}

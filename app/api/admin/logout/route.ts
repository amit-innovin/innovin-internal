import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin";

export async function POST() {
  const res = new NextResponse(null, { status: 303, headers: { Location: "/admin" } });
  res.cookies.set(ADMIN_COOKIE, "", { expires: new Date(0), path: "/" });
  return res;
}

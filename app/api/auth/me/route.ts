import { NextRequest, NextResponse } from "next/server";
import { verifyUserSession, USER_COOKIE } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";
import { store } from "@/lib/store";

// The caller's verified identity (Google sign-in), if any.
export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ signedIn: false, googleEnabled: googleConfigured() });
  const employee = await store.getEmployee(session.email);
  return NextResponse.json({
    signedIn: true,
    googleEnabled: googleConfigured(),
    email: session.email,
    name: employee?.name || session.name,
    picture: employee?.picture ?? "",
    role: employee?.role ?? "member",
  });
}

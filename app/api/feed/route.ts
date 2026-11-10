import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { feedFor } from "@/lib/feed";

export const dynamic = "force-dynamic";

// The Feed: announcements, events, notes, kudos, polls and this week's celebrations.
export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  return NextResponse.json({ ...(await feedFor(session.email)), canModerate: await isAdmin() });
}

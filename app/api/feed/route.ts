import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { feedFor } from "@/lib/feed";

export const dynamic = "force-dynamic";

// The Feed: announcements, events, notes, kudos, polls and this week's celebrations.
export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  const [feed, admin] = await Promise.all([feedFor(session.email), isAdmin()]);
  // Members don't get going counts (a number that changes nothing for them); admins plan with it.
  const posts = admin ? feed.posts : feed.posts.map((p) => (p.type === "event" ? (({ going: _g, ...rest }) => rest)(p) : p));
  return NextResponse.json({ ...feed, posts, canModerate: admin });
}

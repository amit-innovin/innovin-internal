import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { store } from "@/lib/store";
import { todayIST } from "@/lib/time";

export const dynamic = "force-dynamic";

// The important announcement the caller hasn't acknowledged yet (the oldest one still pinned).
export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  const today = todayIST();
  const [rows, acked] = await Promise.all([store.listAnnouncements(50), store.listAckedAnnouncementIds(session.email)]);
  const seen = new Set(acked);
  const next = rows
    // Unacknowledged, and either pinned until today or later, or posted in the last 14 days.
    .filter((a) => a.important && !seen.has(a.id) && (a.pinnedUntil ? a.pinnedUntil >= today : Date.now() - Date.parse(a.createdAt) < 14 * 86_400_000))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  return NextResponse.json(
    { announcement: next ? { id: next.id, title: next.title, body: next.body, authorName: next.authorName ?? null } : null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

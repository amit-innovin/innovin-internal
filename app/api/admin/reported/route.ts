import { NextRequest, NextResponse } from "next/server";
import { badRequest, readJSON, str } from "@/lib/http";
import { isAdmin } from "@/lib/admin";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

// Feed posts people reported, most reported first: the post and a count, never who reported it.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [counts, notices] = await Promise.all([store.countNoticeReports(), store.listNotices(200)]);
  const rows = notices
    .filter((n) => counts[n.id])
    .map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, authorName: n.anonymous ? null : n.authorName, createdAt: n.createdAt, reports: counts[n.id] }))
    .sort((a, b) => b.reports - a.reports || b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json(rows);
}

// "Keep": an admin looked at a reported post and it stays; its reports are cleared.
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = str((await readJSON(req))?.id);
  if (!id) return badRequest("Which post?");
  await store.clearNoticeReports(id);
  return NextResponse.json({ ok: true });
}

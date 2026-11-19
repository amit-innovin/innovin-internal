import { boardHref } from "@/lib/journey";
import { NextRequest,NextResponse } from "next/server";
import { currentActor, isAdmin } from "@/lib/admin";
import { todayIST, validDate } from "@/lib/time";
import { sendPush } from "@/lib/push";
import { id, store } from "@/lib/store";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";

// Redirect back to the admin section with a flash key the page turns into a toast.
const back = (done: "posted" | "deleted" | "missing-title" | "bad-pin") =>
  new NextResponse(null, { status: 303, headers: { Location: `/admin?tab=publish&done=${done}#announcements` } });

export async function GET(req:NextRequest) {
  const id=req.nextUrl.searchParams.get("announcement");
  if(id&&id.length>180)return NextResponse.json({error:"Invalid announcement"},{status:400});
  if(id){const row=await store.getAnnouncement(id);return NextResponse.json(row?[row]:[]);}
  const rows = await store.listAnnouncements(10);
  if (!(await isAdmin())) return NextResponse.json(rows);
  // Admins see how many people acknowledged each important announcement: a count, never names.
  const seen = await store.countAnnouncementAcks(rows.filter((r) => r.important).map((r) => r.id));
  return NextResponse.json(rows.map((r) => (r.important ? { ...r, seen: seen[r.id] ?? 0 } : r)));
}

async function publish(input: { title: string; body: string; tag: string; pinnedUntil: string }) {
  const actor = await currentActor();
  const announcement = await store.addAnnouncement({
    id: id(),
    title: input.title,
    body: input.body,
    tag: input.tag || "Office",
    createdAt: new Date().toISOString(),
    important: true,
    authorName: actor?.name || null,
    pinnedUntil: input.pinnedUntil || null,
  });
  // Best-effort: a push that fails must not fail the post.
  await sendPush({ title: input.title, body: input.body.slice(0, 120), href: boardHref(announcement.id), tag: "announcement" }).catch(() => {});
  return announcement;
}

// The admin app's JSON variant: { title, body, pinnedUntil? } publishes; { action: "delete", id } removes.
async function postJSON(req: Request) {
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  if (!body) return badRequest();
  if (body.action === "delete") {
    const aid = str(body.id).slice(0, 100);
    if (!aid) return badRequest("Which announcement?");
    await store.deleteAnnouncement(aid);
    return NextResponse.json({ ok: true });
  }
  const title = str(body.title).trim().slice(0, 120);
  if (!title) return badRequest("Give it a title");
  const pinnedUntil = str(body.pinnedUntil).trim().slice(0, 10);
  if (pinnedUntil && (!validDate(pinnedUntil) || pinnedUntil < todayIST())) return badRequest("Pick today or a later date");
  const announcement = await publish({ title, body: str(body.body).trim().slice(0, 500), tag: str(body.tag).trim().slice(0, 30), pinnedUntil });
  return NextResponse.json(announcement, { status: 201 });
}

// Admin-only. Plain form post: `_action=delete` removes, otherwise creates. JSON bodies go to postJSON.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (req.headers.get("content-type")?.includes("application/json")) return postJSON(req);

  const form = await req.formData();
  const text = (key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

  if (form.get("_action") === "delete") {
    await store.deleteAnnouncement(text("id", 100));
    return back("deleted");
  }

  const title = text("title", 120);
  if (!title) return back("missing-title");
  const body = text("body", 500);
  const pinnedUntil = text("pinnedUntil", 10);
  // Every announcement is shown once as a dialog (owner ruling). An optional pin keeps it at the
  // top of the Feed until that day, so a pin date must be today or later.
  if (pinnedUntil && (!validDate(pinnedUntil) || pinnedUntil < todayIST())) return back("bad-pin");
  await publish({ title, body, tag: text("tag", 30), pinnedUntil });
  return back("posted");
}

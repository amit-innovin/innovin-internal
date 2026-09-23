import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { id, store } from "@/lib/store";

// Redirect back to the admin section with a flash key the page turns into a toast.
const back = (done: "posted" | "deleted" | "missing-title") =>
  new NextResponse(null, { status: 303, headers: { Location: `/admin?tab=publish&done=${done}#announcements` } });

export async function GET() {
  return NextResponse.json(await store.listAnnouncements(10));
}

// Admin-only. Plain form post: `_action=delete` removes, otherwise creates.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const text = (key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

  if (form.get("_action") === "delete") {
    await store.deleteAnnouncement(text("id", 100));
    return back("deleted");
  }

  const title = text("title", 120);
  if (!title) return back("missing-title");
  await store.addAnnouncement({
    id: id(),
    title,
    body: text("body", 500),
    tag: text("tag", 30) || "Office",
    createdAt: new Date().toISOString(),
  });
  return back("posted");
}

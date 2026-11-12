import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { needsYou } from "@/lib/admin-queue";
import { adminOverview } from "@/lib/admin-view";

export const dynamic = "force-dynamic";

// Everything the admin Overview, Today and Office days screens show, in one read.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [overview, queue] = await Promise.all([adminOverview(), needsYou()]);
  return NextResponse.json({ ...overview, needsYou: queue });
}

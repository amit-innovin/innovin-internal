import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { personMonth } from "@/lib/admin-view";
import { todayIST } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const email = (req.nextUrl.searchParams.get("email") ?? "").toLowerCase();
  const month = req.nextUrl.searchParams.get("month") ?? todayIST().slice(0, 7);
  if (!email || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "Pick a person and a month" }, { status: 400 });
  return NextResponse.json(await personMonth(email, month));
}

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { teamMonth } from "@/lib/admin-view";
import { todayIST } from "@/lib/time";

export const dynamic = "force-dynamic";

// The People grid: everyone's office and leave days for one month (admins only).
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const today = todayIST();
  const month = req.nextUrl.searchParams.get("month") ?? today.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > today.slice(0, 7)) return NextResponse.json({ error: "Pick this month or an earlier one" }, { status: 400 });
  return NextResponse.json(await teamMonth(month, today));
}

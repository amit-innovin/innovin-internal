import { NextResponse } from "next/server";
import { add, id, list, today, updateAttendance } from "@/lib/store";

export async function GET() {
  return NextResponse.json(await list("attendance", today()));
}

export async function POST(req: Request) {
  const { email, action } = await req.json();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const date = today();
  const now = new Date().toISOString();

  if (action === "out") {
    const row = await updateAttendance(email, date, { checkOutAt: now });
    if (!row) return NextResponse.json({ error: "No check-in found for today" }, { status: 404 });
    return NextResponse.json(row);
  }

  const existing = (await list("attendance", date)).find((r) => r.email === email);
  if (existing) return NextResponse.json(existing);

  return NextResponse.json(
    await add("attendance", { id: id(), email, date, checkInAt: now, checkOutAt: null }),
  );
}

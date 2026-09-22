import { NextResponse } from "next/server";
import { id, store } from "@/lib/store";
import { todayIST } from "@/lib/time";

const allowedDomain = (email: string) => {
  const allowed = (process.env.ALLOWED_EMAIL_DOMAINS || "innovinlabs.com").split(",");
  return allowed.includes(email.split("@")[1]?.toLowerCase());
};

export async function GET() {
  return NextResponse.json(await store.listAttendance(todayIST()));
}

export async function POST(req: Request) {
  const { email, action } = await req.json();
  const normalized = (email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!allowedDomain(normalized)) {
    return NextResponse.json({ error: "Use your Innovin email" }, { status: 403 });
  }

  const date = todayIST();
  const now = new Date().toISOString();

  if (action === "out") {
    const row = await store.checkOut(normalized, date, now);
    if (!row) return NextResponse.json({ error: "No check-in found for today" }, { status: 404 });
    return NextResponse.json(row);
  }

  const existing = await store.getAttendance(normalized, date);
  if (existing) return NextResponse.json(existing);

  return NextResponse.json(
    await store.checkIn({ id: id(), email: normalized, date, checkInAt: now, checkOutAt: null }),
  );
}

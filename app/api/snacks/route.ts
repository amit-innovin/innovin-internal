import { NextResponse } from "next/server";
import { MENU, ORDER_CUTOFF_HOUR } from "@/lib/menu";
import { id, store, submitterRef } from "@/lib/store";
import { istHour, todayIST } from "@/lib/time";

export async function GET() {
  const rows = await store.listOrders(todayIST());
  return NextResponse.json(rows.map(({ submitterRef: _r, ...rest }) => rest));
}

export async function POST(req: Request) {
  if (istHour() >= ORDER_CUTOFF_HOUR) {
    return NextResponse.json({ error: "Orders closed for today" }, { status: 403 });
  }

  const { itemId, preference, instructions } = await req.json();
  if (!MENU.some((m) => m.id === itemId)) {
    return NextResponse.json({ error: "Pick a valid item" }, { status: 400 });
  }

  // One order per person per day — re-submitting changes your order.
  const { submitterRef: _r, ...row } = await store.upsertOrder({
    id: id(),
    date: todayIST(),
    itemId,
    preference: preference || "anything",
    instructions: (instructions || "").slice(0, 500),
    submitterRef: submitterRef(req),
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json(row);
}

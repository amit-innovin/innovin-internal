import { NextResponse } from "next/server";
import { MENU, ORDER_CUTOFF_HOUR } from "@/lib/menu";
import { add, id, list, submitterRef, today } from "@/lib/store";

export async function GET() {
  return NextResponse.json(await list("orders", today()));
}

export async function POST(req: Request) {
  if (new Date().getHours() >= ORDER_CUTOFF_HOUR) {
    return NextResponse.json({ error: "Orders closed for today" }, { status: 403 });
  }

  const { itemId, preference, instructions } = await req.json();
  if (!MENU.some((m) => m.id === itemId)) {
    return NextResponse.json({ error: "Pick a valid item" }, { status: 400 });
  }

  const { submitterRef: _r, ...row } = await add("orders", {
    id: id(),
    date: today(),
    itemId,
    preference: preference || "anything",
    instructions: (instructions || "").slice(0, 500),
    submitterRef: submitterRef(req),
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json(row);
}

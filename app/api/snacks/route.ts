import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { orderCutoffHour } from "@/lib/config";
import { DEVICE_COOKIE } from "@/lib/cookies";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { MENU } from "@/lib/menu";
import { id, store } from "@/lib/store";
import {
  cancelOrderForDevice,
  findOrderForDevice,
  ordersForDevice,
  setSubmitterCookie,
  submitterIdentity,
} from "@/lib/submitter";
import { istHour, todayIST } from "@/lib/time";

const PREFERENCES = ["anything", "healthy", "unhealthy"];
const ordersOpen = () => istHour() < orderCutoffHour();

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope");
  const deviceId = req.cookies.get(DEVICE_COOKIE)?.value;
  if (scope === "mine") {
    const order = await findOrderForDevice(deviceId, todayIST());
    return NextResponse.json({ open: ordersOpen(), cutoffHour: orderCutoffHour(), order });
  }
  if (scope === "history") {
    return NextResponse.json(await ordersForDevice(deviceId, 30));
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await store.listOrders(todayIST());
  return NextResponse.json(rows.map(({ submitterRef: _r, ...rest }) => rest));
}

export async function POST(req: NextRequest) {
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  if (!ordersOpen()) {
    return NextResponse.json({ error: "Orders are closed for today" }, { status: 403 });
  }

  const body = await readJSON(req);
  if (!body) return badRequest();
  const itemId = str(body.itemId);
  const preference = str(body.preference) || "anything";
  if (!MENU.some((m) => m.id === itemId)) return badRequest("Pick a valid item");
  if (!PREFERENCES.includes(preference)) return badRequest("Pick a valid preference");

  const identity = submitterIdentity(req);
  // One order per browser per day — re-submitting changes your order.
  const { submitterRef: _r, ...row } = await store.upsertOrder({
    id: id(),
    date: todayIST(),
    itemId,
    preference,
    instructions: str(body.instructions).trim().slice(0, 500),
    submitterRef: identity.ref,
    createdAt: new Date().toISOString(),
  });
  const res = NextResponse.json(row);
  setSubmitterCookie(res, identity.deviceId);
  return res;
}

// Cancel today's order from this device (only before the cutoff).
export async function DELETE(req: NextRequest) {
  if (!ordersOpen()) {
    return NextResponse.json({ error: "Orders are closed — it can't be cancelled now" }, { status: 403 });
  }
  const removed = await cancelOrderForDevice(req.cookies.get(DEVICE_COOKIE)?.value, todayIST());
  return removed
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "No order to cancel" }, { status: 404 });
}

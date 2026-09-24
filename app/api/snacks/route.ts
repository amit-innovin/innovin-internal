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
  ordersForDevice,
  setSubmitterCookie,
  submitterIdentity,
} from "@/lib/submitter";
import { snacksMine } from "@/lib/today";
import { istHour, todayIST } from "@/lib/time";

const PREFERENCES = ["anything", "healthy", "unhealthy"];
const ordersOpen = () => istHour() < orderCutoffHour();

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope");
  const deviceId = req.cookies.get(DEVICE_COOKIE)?.value;
  if (scope === "mine") {
    return NextResponse.json(await snacksMine(deviceId));
  }
  if (scope === "history") {
    return NextResponse.json(await ordersForDevice(deviceId, 90));
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
  const items = body.items;
  const preference = str(body.preference) || "anything";
  if (!Array.isArray(items) || items.some((i) => typeof i !== "string")) return badRequest("Pick a valid item");
  const itemIds = [...new Set(items)] as string[];
  if (itemIds.length === 0) return badRequest("Pick at least one item");
  if (itemIds.length > MENU.length || !itemIds.every((i) => MENU.some((m) => m.id === i))) {
    return badRequest("Pick a valid item");
  }
  if (!PREFERENCES.includes(preference)) return badRequest("Pick a valid preference");

  const identity = submitterIdentity(req);
  const now = new Date().toISOString();
  // One row per item — a day can hold tea + lunch + dinner. Saving replaces the day's selection.
  const rows = await store.setDayOrders(
    todayIST(),
    identity.ref,
    itemIds.map((itemId) => ({
      id: id(),
      date: todayIST(),
      itemId,
      preference: itemId === "healthy" ? "healthy" : preference,
      instructions: str(body.instructions).trim().slice(0, 500),
      submitterRef: identity.ref,
      createdAt: now,
    })),
  );
  const res = NextResponse.json({ items: rows.map(({ submitterRef: _r, ...rest }) => rest) });
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

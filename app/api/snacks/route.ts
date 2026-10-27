import { PantryRequestLockedError, isFulfillment, FULFILLMENT_LABELS } from "@/lib/order-state";
import { sendPush } from "@/lib/push";
import { NextRequest, NextResponse } from "next/server";
import { currentActor, isAdmin } from "@/lib/admin";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { officePantryAllowed } from "@/lib/workspace";
import { PANTRY_LIMIT } from "@/lib/workspace-model";
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
  pantryRef,
} from "@/lib/submitter";
import { snacksMine } from "@/lib/today";
import { istHour, todayIST } from "@/lib/time";

const PREFERENCES = ["anything", "healthy", "unhealthy"];
const ordersOpen = () => istHour() < orderCutoffHour();

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope");
  const deviceId = req.cookies.get(DEVICE_COOKIE)?.value;
  const user = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (scope === "mine") {
    return NextResponse.json({ ...await snacksMine(deviceId, user?.email), officeAllowed: await officePantryAllowed(user?.email), limit: PANTRY_LIMIT });
  }
  if (scope === "history") {
    if (user) return NextResponse.json((await store.listOrdersByRef(pantryRef(user.email), 90)).map(({ submitterRef: _, ...o }) => o));
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

  const user = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!(await officePantryAllowed(user?.email))) return NextResponse.json({ error: "Check in to the office to order from the pantry" }, { status: 403 });

  const body = await readJSON(req);
  if (!body) return badRequest();
  const items = body.items;
  const preference = str(body.preference) || "anything";
  if (!Array.isArray(items) || items.some((i) => typeof i !== "string")) return badRequest("Pick a valid item");
  const itemIds = [...new Set(items)] as string[];
  if (itemIds.length === 0) return badRequest("Pick at least one item");
  if (itemIds.length > PANTRY_LIMIT) return badRequest(`Choose up to ${PANTRY_LIMIT} pantry items per day`);
  if (itemIds.length > MENU.length || !itemIds.every((i) => MENU.some((m) => m.id === i))) {
    return badRequest("Pick a valid item");
  }
  if (!PREFERENCES.includes(preference)) return badRequest("Pick a valid preference");

  const identity = submitterIdentity(req);
  const now = new Date().toISOString();
  // One row per item — a day can hold tea + lunch + dinner. Saving replaces the day's selection.
  let rows;
  try { rows = await store.setDayOrders(
    todayIST(),
    pantryRef(user!.email),
    itemIds.map((itemId) => ({
      id: id(),
      date: todayIST(),
      itemId,
      preference: itemId === "healthy" ? "healthy" : preference,
      instructions: str(body.instructions).trim().slice(0, 500),
      submitterRef: pantryRef(user!.email),
      orderedBy: user!.email,
      createdAt: now,
    })),
  );
  } catch(error) { if(error instanceof PantryRequestLockedError)return NextResponse.json({error:error.message},{status:409});throw error; }
  const res = NextResponse.json({ items: rows.map(({ submitterRef: _r, ...rest }) => rest) });
  setSubmitterCookie(res, identity.deviceId);
  return res;
}

// Cancel today's order from this device (only before the cutoff).
export async function DELETE(req: NextRequest) {
  if (!ordersOpen()) {
    return NextResponse.json({ error: "Orders are closed — it can't be cancelled now" }, { status: 403 });
  }
  const user = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  let removed;try { removed = user ? await store.deleteOrder(pantryRef(user.email), todayIST()) : await cancelOrderForDevice(req.cookies.get(DEVICE_COOKIE)?.value, todayIST()); } catch(error) {if(error instanceof PantryRequestLockedError)return NextResponse.json({error:error.message},{status:409});throw error;}
  return removed
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "No order to cancel" }, { status: 404 });
}

export async function PATCH(req:NextRequest) {
  if(!await isAdmin())return NextResponse.json({error:"Coordinator access required"},{status:403});
  const limited=enforce([["writeIp",clientIp(req)]]);if(limited)return limited;
  const body=await readJSON(req);if(!body)return badRequest();
  const email=str(body.email),date=str(body.date),ids=body.ids;
  if(!email || date!==todayIST() || !Array.isArray(ids) || !ids.length || ids.length>50 || ids.some(x=>typeof x!=="string"||x.length>180) || !isFulfillment(body.expected) || !isFulfillment(body.status))return badRequest("Open today's exact request and choose its next status");
  const actor=await currentActor();
  if(!await store.setOrderFulfillment(date,pantryRef(email),ids as string[],body.expected,body.status,actor&&(actor.role==="admin"||actor.role==="owner")?actor.email:null,new Date().toISOString()))return NextResponse.json({error:"This request changed. Reload and review the current items before updating it."},{status:409});
  await sendPush({title:"Your pantry request was updated",body:"Open the app for its current status.",href:"/snacks?tab=today",tag:`pantry-${date}`},email).catch(()=>{});
  return NextResponse.json({ok:true,status:body.status,label:FULFILLMENT_LABELS[body.status]});
}

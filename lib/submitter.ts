import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { DEVICE_COOKIE, longLivedCookie } from "./cookies";
import { store } from "./store";

const refFor = (deviceId: string) => crypto.createHash("sha256").update(deviceId).digest("hex").slice(0, 32);

const strip = <T extends { submitterRef: string }>({ submitterRef: _r, ...rest }: T) => rest;

export function submitterIdentity(req: NextRequest) {
  const existing = req.cookies.get(DEVICE_COOKIE)?.value;
  const deviceId = existing || crypto.randomUUID();
  return { ref: refFor(deviceId), deviceId: existing ? null : deviceId };
}

export function setSubmitterCookie(res: NextResponse, deviceId: string | null) {
  if (deviceId) res.cookies.set(DEVICE_COOKIE, deviceId, longLivedCookie);
}

// The device's item rows for one day — an order can hold several items (tea + lunch + ...).
export async function ordersForDeviceOn(deviceId: string | undefined, date: string) {
  if (!deviceId) return [];
  const ref = refFor(deviceId);
  return (await store.listOrders(date)).filter((o) => o.submitterRef === ref).map(strip);
}

export async function cancelOrderForDevice(deviceId: string | undefined, date: string) {
  return deviceId ? store.deleteOrder(refFor(deviceId), date) : false;
}

export async function ordersForDevice(deviceId: string | undefined, limit: number) {
  return deviceId ? (await store.listOrdersByRef(refFor(deviceId), limit)).map(strip) : [];
}

// A device only ever sees its own grievances — never anyone else's.
export async function grievancesForDevice(deviceId: string | undefined, limit: number) {
  return deviceId ? (await store.listGrievancesByRef(refFor(deviceId), limit)).map(strip) : [];
}

// Same rule for leave/WFH requests.
export async function awayForDevice(deviceId: string | undefined, limit: number) {
  return deviceId ? (await store.listAwayByRef(refFor(deviceId), limit)).map(strip) : [];
}

import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { DEVICE_COOKIE, longLivedCookie } from "./cookies";
import { store } from "./store";

const refFor = (deviceId: string) => crypto.createHash("sha256").update(deviceId).digest("hex").slice(0, 32);
// Pantry ownership follows the verified employee across devices. Kept separate from device
// identity so this never changes the anonymity boundary for grievances.
export const pantryRef = (email: string) => refFor(`pantry-account:${email.toLowerCase()}`);

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

// Grievance ids live only in the device's own cookie — the DB stores no link at all.
export function grievanceIdsFromCookie(value: string | undefined): string[] {
  try {
    const ids = JSON.parse(value ?? "[]");
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string").slice(0, 50) : [];
  } catch {
    return [];
  }
}

// A device only ever sees grievances whose ids it carries — never anyone else's.
export async function grievancesFromIds(ids: string[], limit: number) {
  return ids.length ? (await store.listGrievancesByIds(ids, limit)).map(strip) : [];
}

// Same rule for leave/WFH requests.
export async function awayForDevice(deviceId: string | undefined, limit: number) {
  return deviceId ? (await store.listAwayByRef(refFor(deviceId), limit)).map(strip) : [];
}

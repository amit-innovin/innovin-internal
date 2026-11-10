import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { DEVICE_COOKIE, longLivedCookie } from "./cookies";
import { store } from "./store";

const refFor = (deviceId: string) => crypto.createHash("sha256").update(deviceId).digest("hex").slice(0, 32);
// A ref that follows the verified employee across devices (event RSVPs). Kept separate from
// device identity so this never changes the anonymity boundary for grievances. The
// "pantry-account:" prefix is historical: changing it would orphan existing RSVPs.
export const accountRef = (email: string) => refFor(`pantry-account:${email.toLowerCase()}`);

const strip = <T extends { submitterRef: string }>({ submitterRef: _r, ...rest }: T) => rest;

export function submitterIdentity(req: NextRequest) {
  const existing = req.cookies.get(DEVICE_COOKIE)?.value;
  const deviceId = existing || crypto.randomUUID();
  return { ref: refFor(deviceId), deviceId: existing ? null : deviceId };
}

export function setSubmitterCookie(res: NextResponse, deviceId: string | null) {
  if (deviceId) res.cookies.set(DEVICE_COOKIE, deviceId, longLivedCookie);
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

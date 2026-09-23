import { NextRequest, NextResponse } from "next/server";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { setSubmitterCookie, submitterIdentity } from "@/lib/submitter";

const speed = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 100_000 ? v : undefined);

export async function GET() {
  return NextResponse.json(await store.listWifi(50));
}

export async function POST(req: NextRequest) {
  const identity = submitterIdentity(req);
  const limited = enforce([
    ["wifiDevice", identity.ref],
    ["wifiIp", clientIp(req)],
  ]);
  if (limited) return limited;

  const body = await readJSON(req);
  if (!body) return badRequest();
  const { quality, downMbps, upMbps } = body;
  if (quality !== "good" && quality !== "poor") return badRequest("quality must be good or poor");
  if ((downMbps != null && speed(downMbps) === undefined) || (upMbps != null && speed(upMbps) === undefined)) {
    return badRequest("Speeds must be positive numbers");
  }

  const res = NextResponse.json(
    await store.addWifi({
      id: id(),
      quality,
      note: str(body.note).trim().slice(0, 500),
      downMbps: speed(downMbps) ?? null,
      upMbps: speed(upMbps) ?? null,
      createdAt: new Date().toISOString(),
    }),
  );
  setSubmitterCookie(res, identity.deviceId);
  return res;
}

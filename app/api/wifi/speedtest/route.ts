import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { enforce } from "@/lib/guard";
import { clientIp } from "@/lib/http";
import { setSubmitterCookie, submitterIdentity } from "@/lib/submitter";

export const dynamic = "force-dynamic";

// 2 MB of incompressible bytes — the client times the download to estimate Mbps.
const PAYLOAD = new Uint8Array(crypto.randomBytes(2 * 1024 * 1024));

export function GET(req: NextRequest) {
  const identity = submitterIdentity(req);
  const limited = enforce([
    ["speedtestDevice", identity.ref],
    ["speedtestIp", clientIp(req)],
  ]);
  if (limited) return limited;

  const res = new NextResponse(PAYLOAD, {
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
  });
  setSubmitterCookie(res, identity.deviceId);
  return res;
}

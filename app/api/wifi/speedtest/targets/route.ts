import { NextRequest, NextResponse } from "next/server";
import { enforce } from "@/lib/guard";
import { clientIp } from "@/lib/http";
import { setSubmitterCookie, submitterIdentity } from "@/lib/submitter";

export const dynamic = "force-dynamic";

// Nearby Netflix CDN nodes to download from, courtesy of fast.com.
//
// Called server-side because api.fast.com sends no Access-Control-Allow-Origin, so a browser
// can't reach it. The nodes it returns *do* send `ACAO: *`, so the browser downloads from them
// directly — which is the point: the measurement has to happen on the office's connection, not
// on ours. Downloading through this server would only measure Vercel's link to Netflix.
//
// This is an undocumented endpoint with a token lifted from fast.com's own client, so treat it
// as best-effort: any failure returns an empty list and the client falls back to
// /api/wifi/speedtest. Set SPEEDTEST_PROVIDER=self to skip fast.com entirely (used by e2e, and
// a kill switch if the endpoint ever changes).
const FAST_API = "https://api.fast.com/netflix/speedtest/v2";
const FAST_TOKEN = "YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm";

// Only ever hand the browser Netflix speedtest URLs — never an arbitrary URL from a third party.
const ALLOWED = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.nflxvideo\.net\/speedtest(\?|$)/i;

type FastTarget = { url?: unknown };

export async function GET(req: NextRequest) {
  const identity = submitterIdentity(req);
  const limited = enforce([
    ["speedtestDevice", identity.ref],
    ["speedtestIp", clientIp(req)],
  ]);
  if (limited) return limited;

  const empty = () => {
    const res = NextResponse.json({ targets: [], city: null });
    setSubmitterCookie(res, identity.deviceId);
    return res;
  };

  if (process.env.SPEEDTEST_PROVIDER === "self") return empty();

  try {
    const upstream = await fetch(`${FAST_API}?https=true&token=${FAST_TOKEN}&urlCount=3`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!upstream.ok) return empty();
    const data = (await upstream.json()) as { targets?: FastTarget[]; client?: { location?: { city?: string } } };
    const targets = (data.targets ?? [])
      .map((t) => (typeof t.url === "string" ? t.url : ""))
      .filter((url) => ALLOWED.test(url))
      .slice(0, 3);

    const res = NextResponse.json({ targets, city: data.client?.location?.city ?? null });
    setSubmitterCookie(res, identity.deviceId);
    return res;
  } catch {
    return empty();
  }
}

import { NextRequest, NextResponse } from "next/server";
import { enforce } from "@/lib/guard";
import { clientIp } from "@/lib/http";

export const dynamic = "force-dynamic";
// Edge runtime, deliberately: api.fast.com picks CDN nodes near *whoever calls it* and ignores
// X-Forwarded-For (verified). Our serverless functions are pinned to Seoul, which returned
// Tokyo and Hong Kong nodes for a Kerala office. Edge functions run near the request instead,
// so the nodes come back local. This also rules out the device-keyed rate limit and cookie
// helpers, which need Node crypto — the per-IP limit is enough for one cheap upstream call.
export const runtime = "edge";

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
  const limited = enforce([["speedtestIp", clientIp(req)]]);
  if (limited) return limited;

  const empty = () => NextResponse.json({ targets: [], city: null });

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

    return NextResponse.json({ targets, city: data.client?.location?.city ?? null });
  } catch {
    return empty();
  }
}

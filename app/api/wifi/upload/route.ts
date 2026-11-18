import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { clientIp } from "@/lib/http";

// The Wi-Fi check's upload probe: reads and discards up to 4 MB, so the client can time it.
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  const limited = enforce([["speedtestIp", clientIp(req)]]);
  if (limited) return limited;
  const reader = req.body?.getReader();
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4_000_000) { await reader.cancel(); break; }
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { pushConfigured, vapidPublicKey } from "@/lib/push";
import { validPushEndpoint } from "@/lib/push-endpoint";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

// The browser needs the public VAPID key to subscribe; it's public by design.
export async function GET() {
  return NextResponse.json({ enabled: pushConfigured(), publicKey: vapidPublicKey() });
}

// Register (or refresh) this browser's push subscription. The signed-in email is attached when
// there is one, which is what lets a leave decision reach that person's devices.
export async function POST(req: NextRequest) {
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  if (!pushConfigured()) return NextResponse.json({ error: "Push isn't configured" }, { status: 503 });

  const body = await readJSON(req);
  const endpoint = str(body?.endpoint).trim();
  const p256dh = str((body?.keys as Record<string, unknown>)?.p256dh).trim();
  const auth = str((body?.keys as Record<string, unknown>)?.auth).trim();
  // Only accept real push endpoints, so this can't be turned into a request forwarder.
  if (!validPushEndpoint(endpoint) || !p256dh || !auth || p256dh.length > 256 || auth.length > 256) return badRequest("Invalid subscription");

  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  await store.savePushSubscription({
    endpoint,
    p256dh,
    auth,
    email: session?.email ?? null,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await readJSON(req);
  const endpoint = str(body?.endpoint).trim();
  if (!endpoint) return badRequest("Invalid subscription");
  await store.deletePushSubscription(endpoint);
  return NextResponse.json({ ok: true });
}

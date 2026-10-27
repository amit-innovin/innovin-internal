import { NextRequest, NextResponse } from "next/server";
import { purchasingActor } from "@/lib/pantry/access";
import { pantryPurchasing } from "@/lib/pantry/service";
import { callbackUri, verifyPending, PANTRY_OAUTH_COOKIE } from "@/lib/pantry/oauth";
import { exchangeToken } from "@/lib/pantry/swiggy";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(req: NextRequest) {
  let result = "failed";
  try {
    const actor = await purchasingActor();
    if (!actor) throw new Error("admin-required");
    const pending = verifyPending(req.cookies.get(PANTRY_OAUTH_COOKIE)?.value, req.nextUrl.searchParams.get("state"), actor.email);
    if (pending.redirectUri !== callbackUri(req.nextUrl.origin)) throw new Error("callback-changed");
    const code = req.nextUrl.searchParams.get("code");
    if (req.nextUrl.searchParams.has("error") || !code || code.length > 4096) throw new Error("denied");
    const tokens = await exchangeToken({ grant_type: "authorization_code", code, client_id: pending.clientId, redirect_uri: pending.redirectUri, code_verifier: pending.verifier });
    await pantryPurchasing.connect(actor.email, tokens, pending.clientId, pending.version);
    result = "connected";
  } catch { /* Never expose provider authorization codes or tokens in a redirect. */ }
  const response = NextResponse.redirect(new URL(`/admin/pantry?connection=${result}`, req.url));
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(PANTRY_OAUTH_COOKIE, "", { path: "/api/pantry-provider", maxAge: 0, httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:" });
  return response;
}

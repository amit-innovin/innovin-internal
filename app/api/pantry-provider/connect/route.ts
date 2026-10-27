import { NextRequest, NextResponse } from "next/server";
import { purchasingActor } from "@/lib/pantry/access";
import { pantryPurchasing } from "@/lib/pantry/service";
import { callbackUri, pendingOAuth, PANTRY_OAUTH_COOKIE } from "@/lib/pantry/oauth";
import { registerClient, swiggyBase, PantryError } from "@/lib/pantry/swiggy";
import { enforce } from "@/lib/guard";
import { clientIp } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const actor = await purchasingActor();
  if (!actor) return NextResponse.redirect(new URL("/admin/pantry?connection=admin-required", req.url));
  const limited = enforce([["writeIp", `pantry-auth:${actor.email}`], ["writeIp", `pantry-auth:${clientIp(req)}`]]);
  if (limited) return limited;
  try {
    const state = await pantryPurchasing.status();
    if (!state.configured) throw new PantryError("Configure the pantry integration encryption key first", 503);
    const redirect = callbackUri(req.nextUrl.origin);
    const clientId = await registerClient(redirect);
    const { pending, cookie, challenge } = pendingOAuth(actor.email, clientId, redirect, state.version);
    const url = new URL("/auth/authorize", swiggyBase());
    url.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirect, scope: "mcp:tools", state: pending.state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
    const res = NextResponse.redirect(url);
    res.headers.set("Cache-Control", "no-store");
    res.cookies.set(PANTRY_OAUTH_COOKIE, cookie, { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", path: "/api/pantry-provider", maxAge: 600 });
    return res;
  } catch(error) {
    const reason = error instanceof PantryError && error.status === 503 ? "setup-required" : "failed";
    return NextResponse.redirect(new URL(`/admin/pantry?connection=${reason}`, req.url));
  }
}

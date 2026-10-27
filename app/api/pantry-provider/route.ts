import { NextRequest, NextResponse } from "next/server";
import { purchasingActor, purchasingError } from "@/lib/pantry/access";
import { enforce } from "@/lib/guard";
import { clientIp, readJSON, badRequest, str } from "@/lib/http";
import { pantryPurchasing as pantry } from "@/lib/pantry/service";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET() {
  if (!await purchasingActor()) return NextResponse.json({ error: "Sign in with an admin Google account to manage purchasing" }, { status: 403 });
  try { return NextResponse.json(await pantry.status(), { headers: { "Cache-Control": "no-store" } }); } catch(error) { return purchasingError(error); }
}
export async function POST(req: NextRequest) {
  const actor = await purchasingActor();
  if (!actor) return NextResponse.json({ error: "Sign in with an admin Google account to manage purchasing" }, { status: 403 });
  if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Open purchasing in this app" }, { status: 403 });
  const limited = enforce([["writeIp", `pantry:${clientIp(req)}`], ["writeIp", `pantry:${actor.email}`]]);
  if (limited) return limited;
  const body = await readJSON(req);
  if (!body) return badRequest();
  const version = body.version;
  if (version !== null && (!Number.isSafeInteger(version) || Number(version) < 1)) return badRequest("Reload the current purchasing basket");
  try {
    let result;
    switch(body.action) {
      case "addresses": result = await pantry.addresses(actor.email, Number(body.page)); break;
      case "address": result = await pantry.selectAddress(actor.email, str(body.id), version as number | null); break;
      case "search": result = await pantry.search(actor.email, str(body.query), Number(body.offset ?? 0)); break;
      case "draft": result = await pantry.setDraft(actor.email, body.items, version as number | null); break;
      case "review": result = await pantry.review(actor.email, body.confirmed === true, version as number | null); break;
      case "checkout": result = await pantry.checkout(actor.email, str(body.quoteId), str(body.paymentMethod), body.confirmed === true); break;
      case "history": return NextResponse.json(await pantry.recentOrders(actor.email));
      case "delivery": return NextResponse.json(await pantry.delivery(actor.email, str(body.attemptId), str(body.orderId)));
      case "reconcile": result = await pantry.reconcile(actor.email, str(body.attemptId), Array.isArray(body.orderIds) ? body.orderIds.filter((v): v is string => typeof v === "string") : [], body.confirmed === true); break;
      case "partial-review": result = await pantry.acknowledgePartial(actor.email, str(body.attemptId), body.confirmed === true); break;
      case "disconnect": result = await pantry.disconnect(actor.email, version as number | null); break;
      default: return badRequest("Unknown purchasing action");
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch(error) { return purchasingError(error); }
}

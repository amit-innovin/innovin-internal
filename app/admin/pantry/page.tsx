import {orderName,orderQuantity} from "@/lib/pantry/shop";
import { PantryFulfillment } from "@/components/pantry-fulfillment";
import Link from "next/link";
import { currentActor } from "@/lib/admin";
import { store } from "@/lib/store";
import { todayIST } from "@/lib/time";
import PantryPurchasing from "@/components/pantry-purchasing";
export const dynamic = "force-dynamic";
export default async function PantryPage({ searchParams }: { searchParams: Promise<{ connection?: string }> }) {
  const actor = await currentActor();
  if (!actor || actor.role !== "admin") return <div className="mx-auto max-w-xl space-y-4"><h1 className="text-2xl font-medium">Office purchasing</h1><p>Sign in with a Google account that has the admin role to connect a purchasing account and place orders.</p><a className="underline" href="/api/auth/google?next=/admin/pantry">Sign in with Google</a><p><Link href="/admin">Back to dashboard</Link></p></div>;
  const orders = await store.listOrders(todayIST());
  const connection = (await searchParams).connection;
  return <div className="mx-auto max-w-4xl space-y-6"><Link className="text-sm underline" href="/admin">Back to dashboard</Link><div><h1 className="text-2xl font-medium">Office purchasing</h1><p className="mt-2 text-sm text-muted-foreground">Collect team requests, choose exact Instamart products, then review and confirm the office order.</p></div>
    <section className="rounded-xl border bg-card p-5"><h2 className="font-medium">Today’s team requests</h2><p className="mt-1 text-sm text-muted-foreground">These requests guide your basket. Start preparing below before purchasing to lock employee changes. Supplier orders never automatically mark a request ready or delivered.</p><ul className="mt-3 space-y-2 text-sm">{[...new Set(orders.map(o=>o.itemId))].map(itemId=>{const rows=orders.filter(o=>o.itemId===itemId);return <li key={itemId}>{orderName(rows[0])} × {rows.reduce((sum,r)=>sum+orderQuantity(r),0)}</li>;})}{!orders.length && <li>No requests yet today.</li>}</ul>{orders.filter(o => o.instructions).map(o => <p key={o.id} className="mt-2 text-sm">{orderName(o)}: {o.instructions}</p>)}{[...new Set(orders.flatMap(o=>o.orderedBy?[o.orderedBy]:[]))].map(email=><p key={email} className="mt-3 text-sm">{email}<PantryFulfillment email={email} orders={orders.filter(o=>o.orderedBy===email)} /></p>)}</section>
    <PantryPurchasing actor={actor.email} connection={connection} />
  </div>;
}

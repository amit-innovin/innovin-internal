"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { send,readError } from "@/lib/fetcher";
import { fulfillmentOf,FULFILLMENT_LABELS,nextFulfillment } from "@/lib/order-state";
import type { OrderRow } from "@/lib/types";
export function PantryFulfillment({email,orders}:{email:string;orders:OrderRow[]}) {
  const [busy,setBusy]=useState(false);const router=useRouter();const current=fulfillmentOf(orders[0]),next=nextFulfillment(current);
  return <select aria-label={`Pantry status for ${email}`} value={current} disabled={busy||!next} className="ml-2 rounded-md border bg-card px-2 py-1 text-xs" onChange={async e=>{
    const status=e.target.value;if(busy||status===current)return;
    if(!window.confirm(status==="requested"?"Reopen this request for changes only after checking any supplier purchase. This does not change or cancel supplier orders.":current==="requested"?"Start preparing this exact request? The employee will need to contact you for further changes. This does not place a supplier order.":`Mark this request ${FULFILLMENT_LABELS[status as keyof typeof FULFILLMENT_LABELS]}?`))return;
    setBusy(true);const res=await send("/api/snacks",{method:"PATCH",json:{email,date:orders[0].date,ids:orders.map(o=>o.id),expected:current,status}});
    if(!res.ok)toast.error(await readError(res));else toast.success("Pantry request updated");router.refresh();setBusy(false);
  }}><option value={current}>{FULFILLMENT_LABELS[current]}</option>{next&&<option value={next}>{FULFILLMENT_LABELS[next]}</option>}{(current==="preparing"||current==="ready")&&<option value="requested">Reopen for changes</option>}</select>;
}

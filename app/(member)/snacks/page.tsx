"use client";
import { orderName,orderQuantity } from "@/lib/pantry/shop";
import type {OrderRow} from "@/lib/types";
import { fulfillmentOf,FULFILLMENT_LABELS, type OrderFulfillment } from "@/lib/order-state";
import { useSearchParams,useRouter } from "next/navigation";
import { LoadRecovery } from "@/components/load-recovery";

import { useEffect, useState,useRef } from "react";
import { Check, Clock, History, Send } from "lucide-react";
import { toast } from "sonner";
import { Empty, IconTile, MENU_ICONS, PageHeader, Segmented, stagger } from "@/components/kit";
import { StatefulButton } from "@/components/motion/button/stateful";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getJSON, readError, send } from "@/lib/fetcher";
import { useButtonState } from "@/lib/hooks/use-button-state";
import { fmtHour, fmtShortDate, relativeDay } from "@/lib/format";
import { MENU } from "@/lib/menu";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Order = Omit<OrderRow,"submitterRef">;
type Mine = { open: boolean; cutoffHour: number; items: Order[]; officeAllowed: boolean; limit: number };

const itemFor = (id: string) => MENU.find((m) => m.id === id);
const names = (items: Order[]) => items.map(orderName).join(" + ");

export default function Snacks() {
  const params=useSearchParams(),router=useRouter();
  const tab=params.get("tab")==="history"?"history":"today";
  const setTab=(next:"today"|"history")=>router.push(`/snacks?tab=${next}`,{scroll:false});
  const writing=useRef(false);
  const pendingWrite=useRef<Promise<boolean>|null>(null);
  const [mine, setMine] = useState<Mine | null>(null);
  const [history, setHistory] = useState<Order[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [buttonState, run] = useButtonState();

  const load = async () => {
    const [today, past] = await Promise.all([
      getJSON<Mine>("/api/snacks?scope=mine", "today's menu",{fresh:true}),
      getJSON<Order[]>("/api/snacks?scope=history", "your request history",{fresh:true}),
    ]);
    if (!today || !past) return;
    setMine(today);
    setHistory(past);
    setSelected(today.items.map((o) => o.itemId));
    setInstructions(today.items[0]?.instructions ?? "");
  };

  async function cancelOrder() {
    if(pendingWrite.current)await pendingWrite.current;
    await saveRequest([],instructions);
  }
  useEffect(()=>{
    load();const refresh=()=>{if(document.visibilityState==="visible"&&!writing.current&&!document.activeElement?.matches("input,textarea,select"))void load();};
    const timer=setInterval(refresh,30000);window.addEventListener("focus",refresh);return()=>{clearInterval(timer);window.removeEventListener("focus",refresh);};
  },[]);

  async function saveRequest(items:string[],note:string) {
    if(writing.current)return false;
    writing.current=true;
    const task=run(async()=>{
      const res=await send("/api/snacks",items.length?{method:"POST",json:{items,instructions:note}}:{method:"DELETE"});
      if(!res.ok){toast.error(await readError(res));await load();return false;}
      toast.success(items.length?"Your pantry request is saved":"Pantry request cancelled",{id:"pantry-request"});await load();return true;
    });
    pendingWrite.current=task;const ok=await task;
    writing.current=false;if(pendingWrite.current===task)pendingWrite.current=null;return ok;
  }
  const toggle=async(id:string)=>{
    if(writing.current)return;
    const next=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id];
    if(!next.length&&!window.confirm("Cancel today's pantry request? This does not cancel any supplier purchase."))return;
    setSelected(next);await saveRequest(next,instructions);
  };
  const submit=(e:React.FormEvent)=>{e.preventDefault();if(selected.length)void saveRequest(selected,instructions);};

  const closed = mine ? !mine.open : false;
  const stage=fulfillmentOf(mine?.items[0]),editable=stage==="requested";
  const chosen = selected.map(itemFor).filter((m): m is (typeof MENU)[number] => !!m);
  const total = chosen.reduce((sum, m) => sum + (m.price ?? 0), 0);
  const historyDays = [...new Set((history ?? []).map((o) => o.date))];
  // Most recent past day's order — the "same as yesterday" shortcut.
  const yesterday = historyDays.length ? history!.filter((o) => o.date === historyDays[0]) : null;

  if(tab==="today"&&mine?.items.some(r=>r.product))return <div className="mx-auto max-w-xl"><PageHeader title="Your pantry request" subtitle="Your exact-product request is managed in the office shop."/><p className="studio-notice">{FULFILLMENT_LABELS[stage]} — {names(mine.items)}</p><Link className="studio-button mt-5" href="/pantry">Open your product request ↗</Link><Link className="block mt-5 underline" href="/snacks?tab=history">Request history</Link></div>;
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Meals & Snacks" subtitle="Your pantry request — selections save automatically." />
      {mine && !mine.officeAllowed && <div className="studio-notice mb-4">Pantry ordering is for teammates checked in to the office. <Link href="/" className="underline">Set your presence on Overview</Link>. You can still view your requests and cancel before preparation starts and the cutoff.</div>}
      {mine?.officeAllowed && <p className="text-xs text-muted-foreground mb-4">Choose up to {mine.limit} items per day. Your request follows your account across devices; supplier purchases are handled separately.</p>}

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "today", label: "Today" },
          { value: "history", label: "History" },
        ]}
      />

      {!mine || !history ? (<LoadRecovery>
        <Card className="mt-5 gap-3 p-5">
          <Skeleton className="h-4 w-40" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </Card>
      </LoadRecovery>) : tab === "today" ? (
        <form onSubmit={submit} className="t-stagger mt-5">
          {/* Status first — "did my order go through?" is the #1 question. */}
          <Card
            className={cn(
              "gap-0 p-4",
              mine.items.length > 0 && "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30",
            )}
            style={stagger(0)}
          >
            {mine.items.length > 0 ? (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                ✓ {FULFILLMENT_LABELS[stage]} — {names(mine.items)}
                <span className="ml-1 font-normal text-emerald-600/80 dark:text-emerald-500">
                  {mine.items[0]?.instructions ? `· ${mine.items[0].instructions}` : ""}
                </span>
              </p>
            ) : closed ? (
              <p className="text-sm text-muted-foreground">Orders are closed for today — see you tomorrow.</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing ordered yet{mine.cutoffHour < 24 ? ` — closes at ${fmtHour(mine.cutoffHour)}` : ""}. Tap what you want below.
              </p>
            )}
            {!mine.items.length && !closed && yesterday && !yesterday.some(o=>o.product) && (
              <button
                type="button"
                disabled={!mine.officeAllowed||!editable||writing.current}
                onClick={() => { const items=yesterday.map(o=>o.itemId),note=yesterday[0]?.instructions??"";setSelected(items);setInstructions(note);void saveRequest(items,note); }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent"
              >
                <History className="size-3.5" /> Repeat last request ({yesterday.map((o) => itemFor(o.itemId)?.name).join(" + ")})
              </button>
            )}
          </Card>

          {!mine.items.length && yesterday?.some(o=>o.product) && <Link className="inline-flex min-h-11 items-center text-sm underline mt-3" href="/pantry">Browse the office shop to request products again ↗</Link>}

          {/* Menu as tap tiles — see it, tap it, done. */}
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5" style={stagger(1)}>
            {MENU.map((m) => {
              const active = selected.includes(m.id);
              const Icon = MENU_ICONS[m.icon];
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={writing.current || closed || !editable || !mine.officeAllowed || (!active && selected.length >= mine.limit)}
                  onClick={() => toggle(m.id)}
                  aria-pressed={active}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-xl border px-2 py-4 transition-all disabled:cursor-not-allowed disabled:opacity-50",
                    active ? "border-brand bg-brand-tint shadow-sm" : "bg-card hover:bg-muted/60",
                  )}
                >
                  <IconTile icon={Icon} tone={m.tone} size="sm" />
                  <span className="text-xs font-medium leading-tight">{m.name}</span>
                  <span className="text-[11px] text-muted-foreground">{m.price != null ? `₹${m.price}` : "Coordinated"}</span>
                  {active && (
                    <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-white shadow">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <Card className="mt-4 gap-0 p-4" style={stagger(2)}>
            {chosen.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{chosen.map((m) => m.name).join(" + ")}</span>
                <span className="font-medium">{total > 0 ? `₹${total}` : ""}</span>
              </div>
            )}
            <Input
              value={instructions}
              disabled={closed || !editable || writing.current}
              onBlur={() => { if(selected.length && instructions !== (mine.items[0]?.instructions??""))void saveRequest(selected,instructions); }}
              maxLength={500}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Anything specific? (no sugar, less spicy…)"
              className={cn(chosen.length ? "mt-2" : "")}
              aria-label="Special instructions"
            />
          </Card>

          <div style={stagger(3)}>
            <StatefulButton
              type="submit"
              state={buttonState}
              disabled={!selected.length || closed || !editable || !mine.officeAllowed}
              loadingText="Saving request"
              successText="Request saved"
              errorText="Try again"
              icon={<Send className="size-4" />}
              className="mt-4 h-11 w-full rounded-lg font-medium"
            >
              {mine.items.length ? "Save request notes" : "Save pantry request"}
            </StatefulButton>
            {mine.items.length > 0 && !closed && editable && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" disabled={buttonState==="loading"} variant="ghost" size="xl" className="mt-2 w-full text-muted-foreground hover:text-destructive">
                    Cancel today&apos;s request
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel today&apos;s request?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {names(mine.items)} will be removed from today&apos;s list. You can order again
                      {mine.cutoffHour >= 24 ? " anytime today." : ` until ${fmtHour(mine.cutoffHour)}.`} This does not cancel any supplier purchase.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep request</AlertDialogCancel>
                    <AlertDialogAction disabled={buttonState==="loading"} variant="destructive" onClick={cancelOrder}>
                      Cancel request
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </form>
      ) : (
        <Card className="mt-5 gap-0 p-2">
          {history.length === 0 ? (
            <Empty>No previous pantry requests for this account yet.</Empty>
          ) : (
            historyDays.map((date) => {
              const dayOrders = history.filter((o) => o.date === date);
              return (
                <div key={date}>
                  <p className="px-3 pt-3 text-xs font-medium text-muted-foreground">
                    {relativeDay(dayOrders[0].createdAt)} · {fmtShortDate(dayOrders[0].createdAt)}
                  </p>
                  <ul className="t-stagger divide-y">
                    {dayOrders.map((o, i) => {
                      const it = itemFor(o.itemId);
                      return (
                        <li key={o.id} className="flex items-center gap-3 px-3 py-3" style={stagger(i)}>
                          <IconTile icon={MENU_ICONS[it?.icon ?? "coffee"]} tone={it?.tone ?? "sky"} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{orderName(o)}{o.product?` × ${orderQuantity(o)}`:""}</p>
                            {o.instructions && <p className="truncate text-xs text-muted-foreground">{o.instructions}</p>}
                          </div>
                          <span className="text-sm font-medium">{o.product?`₹${o.product.price*o.product.quantity} estimate`:it?.price != null ? `₹${it.price}` : "—"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </Card>
      )}
    </div>
  );
}

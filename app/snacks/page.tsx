"use client";

import { useEffect, useState } from "react";
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

type Order = { id: string; date: string; itemId: string; instructions: string; createdAt: string };
type Mine = { open: boolean; cutoffHour: number; items: Order[] };

const itemFor = (id: string) => MENU.find((m) => m.id === id);
const names = (items: Order[]) => items.map((o) => itemFor(o.itemId)?.name ?? o.itemId).join(" + ");

export default function Snacks() {
  const [tab, setTab] = useState<"today" | "history">("today");
  const [mine, setMine] = useState<Mine | null>(null);
  const [history, setHistory] = useState<Order[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [buttonState, run] = useButtonState();

  const load = async () => {
    const [today, past] = await Promise.all([
      getJSON<Mine>("/api/snacks?scope=mine", "today's menu"),
      getJSON<Order[]>("/api/snacks?scope=history", "your order history"),
    ]);
    if (!today || !past) return;
    setMine(today);
    setHistory(past);
    setSelected(today.items.map((o) => o.itemId));
    setInstructions(today.items[0]?.instructions ?? "");
  };

  async function cancelOrder() {
    const res = await send("/api/snacks", { method: "DELETE" });
    if (res.ok) toast.success("Order cancelled");
    else toast.error(await readError(res));
    await load();
  }
  useEffect(() => {
    load();
  }, []);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected.length) return;
    const updating = !!mine?.items.length;
    run(async () => {
      const res = await send("/api/snacks", {
        method: "POST",
        json: { items: selected, instructions },
      });
      if (!res.ok) {
        toast.error(await readError(res));
        // e.g. the page was left open past the cutoff — refresh so the UI shows "closed".
        await load();
        return false;
      }
      const label = selected.map((i) => itemFor(i)?.name).join(" + ");
      toast.success(`Order ${updating ? "updated" : "placed"}: ${label}`);
      await load();
      return true;
    });
  };

  const closed = mine ? !mine.open : false;
  const chosen = selected.map(itemFor).filter((m): m is (typeof MENU)[number] => !!m);
  const total = chosen.reduce((sum, m) => sum + (m.price ?? 0), 0);
  const historyDays = [...new Set((history ?? []).map((o) => o.date))];
  // Most recent past day's order — the "same as yesterday" shortcut.
  const yesterday = historyDays.length ? history!.filter((o) => o.date === historyDays[0]) : null;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Meals & Snacks" subtitle="Today&apos;s kitchen order — tap, done." />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "today", label: "Today" },
          { value: "history", label: "History" },
        ]}
      />

      {!mine || !history ? (
        <Card className="mt-5 gap-3 p-5">
          <Skeleton className="h-4 w-40" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </Card>
      ) : tab === "today" ? (
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
                ✓ Ordered — {names(mine.items)}
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
            {!mine.items.length && !closed && yesterday && (
              <button
                type="button"
                onClick={() => {
                  setSelected(yesterday.map((o) => o.itemId));
                  setInstructions(yesterday[0]?.instructions ?? "");
                  toast.success("Same as yesterday — hit Place order to confirm");
                }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent"
              >
                <History className="size-3.5" /> Same as yesterday ({yesterday.map((o) => itemFor(o.itemId)?.name).join(" + ")})
              </button>
            )}
          </Card>

          {/* Menu as tap tiles — see it, tap it, done. */}
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5" style={stagger(1)}>
            {MENU.map((m) => {
              const active = selected.includes(m.id);
              const Icon = MENU_ICONS[m.icon];
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={closed}
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
              disabled={closed}
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
              disabled={!selected.length || closed}
              loadingText="Placing order"
              successText="Order placed"
              errorText="Try again"
              icon={<Send className="size-4" />}
              className="mt-4 h-11 w-full rounded-lg font-medium"
            >
              {mine.items.length ? "Update order" : "Place order"}
            </StatefulButton>
            {mine.items.length > 0 && !closed && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="xl" className="mt-2 w-full text-muted-foreground hover:text-destructive">
                    Cancel today&apos;s order
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel today&apos;s order?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {names(mine.items)} will be removed from today&apos;s list. You can order again
                      {mine.cutoffHour >= 24 ? " anytime today." : ` until ${fmtHour(mine.cutoffHour)}.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep order</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={cancelOrder}>
                      Cancel order
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
            <Empty>No past orders from this device yet.</Empty>
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
                            <p className="text-sm font-medium">{it?.name ?? o.itemId}</p>
                            {o.instructions && <p className="truncate text-xs text-muted-foreground">{o.instructions}</p>}
                          </div>
                          <span className="text-sm font-medium">{it?.price != null ? `₹${it.price}` : "—"}</span>
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

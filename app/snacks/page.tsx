"use client";

import { useEffect, useState } from "react";
import { Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { Empty, IconTile, MENU_ICONS, PageHeader, PlusCheck, Segmented, stagger } from "@/components/kit";
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
import { Separator } from "@/components/ui/separator";
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

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Meals & Snacks" />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "today", label: "Today" },
          { value: "history", label: "History" },
        ]}
      />

      {!mine || !history ? (
        <Card className="mt-5 gap-0 p-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="size-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="size-8 rounded-full" />
            </div>
          ))}
        </Card>
      ) : tab === "today" ? (
        <form onSubmit={submit} className="t-stagger mt-5">
          <Card className="gap-0 p-0" style={stagger(0)}>
            {MENU.map((m, i) => {
              const active = selected.includes(m.id);
              return (
                <div key={m.id}>
                  {i > 0 && <Separator />}
                  <button
                    type="button"
                    disabled={closed}
                    onClick={() => toggle(m.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      active ? "bg-accent/60" : "hover:bg-muted/60",
                    )}
                  >
                    <IconTile icon={MENU_ICONS[m.icon]} tone={m.tone} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.price != null ? `₹${m.price}` : "Ask coordinator"}</div>
                    </div>
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full shadow-sm transition-colors duration-200",
                        active ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground",
                      )}
                    >
                      <PlusCheck checked={active} />
                    </span>
                  </button>
                </div>
              );
            })}
          </Card>

          <Card className="mt-4 gap-0 p-4" style={stagger(1)}>
            <p className="text-sm font-medium">Order summary</p>
            {chosen.length ? (
              <div className="mt-2 space-y-1 text-sm">
                {chosen.map((m) => (
                  <div key={m.id} className="flex items-center justify-between">
                    <span className="text-muted-foreground">1 × {m.name}</span>
                    <span className="font-medium">{m.price != null ? `₹${m.price}` : "—"}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-1.5 font-medium">
                  <span>Total</span>
                  <span>₹{total}</span>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">No items selected</p>
            )}
            <Input
              value={instructions}
              disabled={closed}
              maxLength={500}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Special instructions (optional) — e.g. no sugar"
              className="mt-3"
              aria-label="Special instructions"
            />
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              {closed
                ? "Orders are closed for today"
                : mine.cutoffHour >= 24
                  ? "Order anytime today — change it as often as you like"
                  : `Orders close by ${fmtHour(mine.cutoffHour)}`}
            </p>
          </Card>

          <div style={stagger(2)}>
            <StatefulButton
              type="submit"
              state={buttonState}
              disabled={!selected.length || closed}
              loadingText="Placing order"
              successText="Order placed"
              errorText="Try again"
              icon={<Send className="size-4" />}
              className="mt-5 h-11 w-full rounded-lg font-medium"
            >
              {mine.items.length ? "Update Order" : "Submit Order"}
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

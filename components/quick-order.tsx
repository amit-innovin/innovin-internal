"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MENU_ICONS } from "@/components/kit";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getJSON, readError, send } from "@/lib/fetcher";
import { fmtHour } from "@/lib/format";
import { MENU } from "@/lib/menu";
import { cn } from "@/lib/utils";

type Mine = { open: boolean; cutoffHour: number; items: { itemId: string }[] };

// Today's food order, right on home: tap what you want, done. The full page keeps the
// summary, instructions field, order history and cancellation — ordering itself is one tap.
export default function QuickOrder() {
  const [mine, setMine] = useState<Mine | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const data = await getJSON<Mine>("/api/snacks?scope=mine", "today's menu");
    if (data) {
      setMine(data);
      setSelected(data.items.map((o) => o.itemId));
    }
  };
  useEffect(() => {
    load();
  }, []);

  const toggle = async (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    setBusy(true);
    if (next.length === 0) {
      const res = await send("/api/snacks", { method: "DELETE" });
      if (res.ok) toast.success("Order cleared");
      else toast.error(await readError(res));
    } else {
      const res = await send("/api/snacks", { method: "POST", json: { items: next } });
      if (res.ok) toast.success("Order's in — nice");
      else {
        toast.error(await readError(res));
        await load();
      }
    }
    setBusy(false);
  };

  if (!mine) {
    return (
      <Card className="gap-3 p-5">
        <Skeleton className="h-3 w-24" />
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 flex-1 rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow">Today&apos;s food</h2>
        <span className="text-xs text-muted-foreground">
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : mine.open ? (
            mine.cutoffHour >= 24 ? "Order anytime" : `Until ${fmtHour(mine.cutoffHour)}`
          ) : (
            "Closed today"
          )}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {MENU.map((m) => {
          const active = selected.includes(m.id);
          const Icon = MENU_ICONS[m.icon];
          return (
            <button
              key={m.id}
              type="button"
              disabled={!mine.open || busy}
              onClick={() => toggle(m.id)}
              aria-pressed={active}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-[11px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
                active ? "border-brand bg-brand-tint text-brand shadow-sm" : "bg-card text-muted-foreground hover:bg-muted/60",
              )}
            >
              <Icon className="size-5" />
              {m.name}
              {active && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand text-white">
                  <Check className="size-2.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{selected.length ? `${selected.map((id) => MENU.find((m) => m.id === id)?.name).join(" + ")}` : "Tap what you fancy"}</span>
        <Link href="/snacks" className="font-medium text-accent-foreground hover:underline">
          Notes & history →
        </Link>
      </div>
    </Card>
  );
}

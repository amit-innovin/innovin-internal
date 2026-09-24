"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Flame, Footprints, Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getJSON, readError, send } from "@/lib/fetcher";

type BoardEntry = { email: string; name: string; days: number; streak: number; todayHit: boolean };
type StepsData = {
  goal: number;
  today: string;
  signedIn: boolean;
  board: BoardEntry[];
  me: { days: number; streak: number; rank: number | null; today: { hit: boolean; steps: number | null } | null } | null;
};

// The day's third action: did you hit 10K? One tap, or add the count. The board lives on /steps.
export default function StepsCard() {
  const [data, setData] = useState<StepsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCount, setShowCount] = useState(false);
  const [count, setCount] = useState("");

  const load = async () => {
    const d = await getJSON<StepsData>("/api/steps", "the steps board");
    if (d) setData(d);
  };
  useEffect(() => {
    load();
  }, []);

  const log = async (steps: number | null) => {
    setBusy(true);
    const res = await send("/api/steps", { method: "POST", json: steps === null ? { hit: true } : { steps } });
    if (res.ok) {
      const { hit } = await res.json();
      toast.success(hit ? "10K — nice walking!" : "Logged — tomorrow's another day");
      setShowCount(false);
      setCount("");
      await load();
    } else {
      toast.error(await readError(res));
    }
    setBusy(false);
  };

  if (!data) {
    return (
      <Card className="gap-3 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-full" />
      </Card>
    );
  }

  const me = data.me;
  const top = data.board[0];

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center gap-2">
        <Footprints className="size-3.5 text-brand" />
        <h2 className="eyebrow">10K Steps</h2>
      </div>

      {!data.signedIn ? (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {top ? `${top.name} leads with ${top.days} days.` : "The 10K-a-day challenge is on."} Sign in to log yours.
          </p>
          <Button asChild size="xl" className="mt-4 w-full">
            <a href="/api/auth/google?next=/">Sign in to join</a>
          </Button>
        </>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-medium">
                {me?.today?.hit ? "Done — you walked it" : me?.today ? "Logged as missed" : "Hit 10K today?"}
              </p>
              <p className="text-xs text-muted-foreground">
                {me && me.days > 0
                  ? `${me.days} ${me.days === 1 ? "day" : "days"}${me.streak > 1 ? ` · ${me.streak}-day streak` : ""}${me.rank ? ` · #${me.rank}` : ""}`
                  : "Your first day counts double — in spirit"}
              </p>
            </div>
            {me && me.streak > 1 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                <Flame className="size-3.5" /> {me.streak}
              </span>
            )}
          </div>

          {!me?.today?.hit && (
            <div className="mt-4 space-y-2">
              <Button
                onClick={() => log(null)}
                disabled={busy}
                size="xl"
                className="w-full"
                variant={me?.today ? "secondary" : "default"}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Check />} {me?.today ? "Actually, I hit it" : "Yes, hit it"}
              </Button>
              {showCount ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    log(Number(count));
                  }}
                >
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    placeholder="Step count"
                    aria-label="Today's step count"
                    required
                    className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm tabular-nums outline-none focus-visible:border-ring"
                  />
                  <Button type="submit" variant="secondary" disabled={busy} className="shrink-0">
                    Log it
                  </Button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCount(true)}
                  className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Add your step count →
                </button>
              )}
            </div>
          )}

          {top && (
            <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Trophy className="size-3.5 shrink-0 text-amber-500" />
                <span className="truncate">{top.name} · {top.days} days</span>
              </span>
              <span>{data.board.filter((b) => b.todayHit).length} hit it today</span>
            </div>
          )}
        </>
      )}
      <Link href="/steps" className="mt-3 block text-center text-xs font-medium text-accent-foreground hover:underline">
        Leaderboard →
      </Link>
    </Card>
  );
}

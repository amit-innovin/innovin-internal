"use client";

import { useEffect, useState } from "react";
import { Check, Flame, Footprints, Medal, Trophy } from "lucide-react";
import { Empty, IconTile, PageHeader, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getJSON } from "@/lib/fetcher";
import { fmtShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type BoardEntry = { email: string; name: string; days: number; streak: number; todayHit: boolean; todaySteps: number | null };
type StepsData = {
  goal: number;
  signedIn: boolean;
  board: BoardEntry[];
  me: {
    days: number;
    streak: number;
    rank: number | null;
    today: { hit: boolean; steps: number | null } | null;
    recent: { date: string; hit: boolean; steps: number | null }[];
  } | null;
};

const medal = (rank: number) =>
  rank === 1 ? "text-amber-500" : rank === 2 ? "text-slate-400" : rank === 3 ? "text-amber-700" : "text-muted-foreground";

// The 10K challenge board. Logging happens on home (or the button below); this page is the
// scoreboard plus your own trail.
export default function Steps() {
  const [data, setData] = useState<StepsData | null>(null);
  useEffect(() => {
    getJSON<StepsData>("/api/steps", "the steps board").then((d) => d && setData(d));
  }, []);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="10K Steps" subtitle="Walked 10,000 today? Log it on home — this is the board." />

      {!data ? (
        <Card className="gap-3 p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </Card>
      ) : (
        <div className="t-stagger">
          {data.me && (
            <Card className="gap-0 p-5" style={stagger(0)}>
              <div className="flex items-center gap-3">
                <IconTile icon={Footprints} tone={data.me.today?.hit ? "green" : "blue"} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {data.me.today?.hit
                      ? `Today ✓${data.me.today.steps ? ` — ${data.me.today.steps.toLocaleString("en-IN")} steps` : ""}`
                      : data.me.today
                        ? "Today logged as missed"
                        : "Not logged yet today"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.me.days} {data.me.days === 1 ? "day" : "days"} total
                    {data.me.streak > 1 ? ` · ${data.me.streak}-day streak` : ""}
                    {data.me.rank ? ` · rank #${data.me.rank}` : ""}
                  </p>
                </div>
              </div>
              {data.me.recent.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5 border-t pt-4">
                  {data.me.recent.map((d) => (
                    <span
                      key={d.date}
                      title={d.steps ? `${d.steps.toLocaleString("en-IN")} steps` : undefined}
                      className={cn(
                        "rounded-md px-2 py-1 text-[11px] tabular-nums",
                        d.hit ? "bg-emerald-50 font-medium text-emerald-700" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {fmtShortDate(`${d.date}T00:00:00`)}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card className="mt-4 gap-0 p-5" style={stagger(1)}>
            <div className="flex items-center gap-2">
              <Trophy className="size-3.5 text-brand" />
              <h2 className="eyebrow">Leaderboard</h2>
            </div>
            {data.board.length === 0 ? (
              <Empty>Nobody on the board yet — first walk claims the crown.</Empty>
            ) : (
              <ul className="mt-2 divide-y">
                {data.board.map((b, i) => (
                  <li key={b.email} className="flex items-center gap-3 py-3">
                    <span className={cn("w-6 text-center text-sm font-semibold tabular-nums", medal(i + 1))}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.todayHit ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <Check className="size-3" /> today{b.todaySteps ? ` · ${b.todaySteps.toLocaleString("en-IN")}` : ""}
                          </span>
                        ) : (
                          "not yet today"
                        )}
                        {b.streak > 1 && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-amber-600">
                            <Flame className="size-3" /> {b.streak}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {b.days} <span className="text-xs font-normal text-muted-foreground">{b.days === 1 ? "day" : "days"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <p className="mt-4 text-center text-xs text-muted-foreground" style={stagger(2)}>
            Honor system — log the days you actually hit {data.goal.toLocaleString("en-IN")}. Only today is writable.
            <Medal className="ml-1 inline size-3.5 -translate-y-px" />
          </p>
        </div>
      )}
    </div>
  );
}

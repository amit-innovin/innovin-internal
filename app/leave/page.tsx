"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarOff, Info, Plane } from "lucide-react";
import { Empty, IconTile, PageHeader, SectionHeader, stagger } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getJSON } from "@/lib/fetcher";
import { fmtShortDate } from "@/lib/format";
import { LEAVE_LABELS, type LeaveType } from "@/lib/leave";

type Ledger = { type: LeaveType; entitled: number; used: number; pending: number; remaining: number };
type Summary = {
  signedIn: boolean;
  year: number;
  name?: string;
  joinedOn?: string | null;
  ledger?: Ledger[];
  earned?: { accrued: number | null; canAvail: boolean; note: string | null };
  holidays?: { date: string; name: string }[];
};

const DESCRIPTION: Record<LeaveType, string> = {
  cl: "Short personal breaks · half-days allowed",
  sl: "Illness or health-related absence",
  el: "Accrues 1.25 days a month · usable after a year",
  fl: "For personal, cultural or religious observances",
  ml: "Maternity leave",
};

// Leave is tracked in half days — show 2 not 2.0, but keep the .5 when there is one.
const days = (n: number) => `${Number(n.toFixed(1))}`;

function Balance({ row }: { row: Ledger }) {
  const over = row.remaining < 0;
  return (
    <li className="py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{LEAVE_LABELS[row.type]} Leave</p>
        <p className={`shrink-0 text-sm font-medium tabular-nums ${over ? "text-rose-600" : ""}`}>
          {days(row.remaining)} <span className="text-xs font-normal text-muted-foreground">of {days(row.entitled)} left</span>
        </p>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <p className="flex-1 text-xs text-muted-foreground">{DESCRIPTION[row.type]}</p>
        {row.pending > 0 && (
          <Badge variant="secondary" className="shrink-0 text-[11px]">
            {days(row.pending)} pending
          </Badge>
        )}
        {over && (
          <Badge variant="secondary" className="shrink-0 text-[11px] text-rose-600">
            over by {days(-row.remaining)}
          </Badge>
        )}
      </div>
    </li>
  );
}

export default function Leave() {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    getJSON<Summary>("/api/leave", "your leave balance").then((d) => d && setData(d));
  }, []);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Leave tracker" subtitle="Your balances for the year, and the holiday calendar" />

      {!data ? (
        <Card className="gap-3 p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full" />
        </Card>
      ) : !data.signedIn ? (
        <Card className="items-center gap-3 p-8 text-center">
          <IconTile icon={Plane} tone="sky" />
          <p className="text-sm text-muted-foreground">
            Sign in with your Innovin Google account to see your leave balances — they&apos;re tied to your identity, not this device.
          </p>
          <Button asChild size="lg">
            {/* A plain anchor: a Next Link would prefetch the OAuth route and trip CSP. */}
            <a href="/api/auth/google?next=/leave">Sign in</a>
          </Button>
        </Card>
      ) : (
        <>
          <Card className="gap-0 p-5">
            <SectionHeader title={`Balance · ${data.year}`} aside={data.joinedOn ? `Joined ${fmtShortDate(`${data.joinedOn}T00:00:00`)}` : undefined} />
            <ul className="mt-1 divide-y">
              {data.ledger?.map((row, i) => (
                <div key={row.type} style={stagger(i)}>
                  <Balance row={row} />
                </div>
              ))}
            </ul>
            {data.earned?.note && (
              <p className="mt-4 flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                {data.earned.note}
              </p>
            )}
            <Button asChild variant="outline" size="lg" className="mt-4">
              <Link href="/away">
                <CalendarOff /> Request leave or WFH
              </Link>
            </Button>
          </Card>

          <Card className="mt-4 gap-0 p-5">
            <SectionHeader title={`Holidays · ${data.year}`} aside={`${data.holidays?.length ?? 0} days`} />
            <p className="mt-1 text-xs text-muted-foreground">
              Sundays and the 2nd and 4th Saturday are weekly offs. Leave never counts these or the holidays below.
            </p>
            {data.holidays?.length ? (
              <ul className="mt-3 divide-y">
                {data.holidays.map((h) => (
                  <li key={h.date} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate">{h.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtShortDate(`${h.date}T00:00:00`)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>The holiday calendar for this year hasn&apos;t been added yet.</Empty>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

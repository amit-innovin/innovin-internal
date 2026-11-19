"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { QueryState } from "@/components/m3";
import { PageHero } from "@/components/m3/hero";
import { useDays } from "@/lib/queries";
import { Calendar, type Day, type DayAction } from "./calendar";
import { ComingUp } from "./coming-up";
import { DaySheet } from "./day-sheet";
import { LeaveRequests } from "./leave-requests";
import { UsualDays } from "./usual-days";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// Days from the Material 3 prototype: plan your own month and apply for leave. A missed day is
// fixed by an admin.
// Planning is from your own target only; nothing here says who else will be in.
export function DaysPage() {
  const raw = useSearchParams().get("month");
  const days = useDays(raw && MONTH.test(raw) ? raw : undefined);
  const [picked, setPicked] = useState<{ day: Day; action: DayAction } | null>(null);
  const close = () => setPicked(null);

  return (
    <div className="m3 m3-page m3-stack">
      <PageHero page="days" title="Days" subtitle="Tap a date to plan a day in, or to apply for leave" />
      {!days.data ? <QueryState error={days.error} onRetry={() => days.refetch()} what="your days" /> : (
        <>
          <Calendar view={days.data} onPick={(day, action) => setPicked({ day, action })} />
          <ComingUp view={days.data} />
          <UsualDays key={days.data.officeDays.join(",")} officeDays={days.data.officeDays} />
          <LeaveRequests today={days.data.today} />
          {picked && <DaySheet key={picked.day.date} view={days.data} day={picked.day} leaveOnly={picked.action === "today"} onClose={close} />}
        </>
      )}
    </div>
  );
}

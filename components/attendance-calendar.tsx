"use client";
import { LoadRecovery } from "@/components/load-recovery";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Empty, SectionHeader } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getJSON } from "@/lib/fetcher";
import { LOCATION_LABEL, type LocationTag } from "@/lib/geo";
import { fmtShortDate, fmtTime } from "@/lib/format";
import { LEAVE_LABELS, type LeaveType } from "@/lib/leave";

type Day = {
  date: string;
  present: boolean;
  open: boolean;
  location: LocationTag | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  holiday: string | null;
  working: boolean;
  off: string | null;
  leave: { type: LeaveType | null; kind: "leave" | "wfh"; status: string; halfDay: boolean } | null;
};
type Month = {
  month: string;
  today: string;
  email: string | null;
  verified: boolean;
  workingDays: number;
  days: Day[];
  upcomingHolidays: { date: string; name: string }[];
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

// Monday-first offset for the 1st of the month, so the grid lines up under M T W T F S S.
const leadingBlanks = (key: string) => (new Date(`${key}-01T00:00:00Z`).getUTCDay() + 6) % 7;

// What the dot under each date means. Present wins over everything: if you worked, you worked.
// Amber while still checked in, green once the day is closed out.
function dotClass(day: Day) {
  if (day.present) return day.open ? "bg-amber-500" : "bg-emerald-500";
  if (day.leave) return day.leave.kind === "wfh" ? "bg-sky-500" : "bg-violet-500";
  if (day.holiday) return "bg-rose-400";
  if (!day.working) return "bg-muted-foreground/25";
  return "bg-transparent";
}

function dayHeadline(day: Day) {
  if (day.present) {
    const where = day.location ? LOCATION_LABEL[day.location] : "Location not shared";
    const times = day.checkInAt
      ? ` · in ${fmtTime(day.checkInAt)}${day.checkOutAt ? `, out ${fmtTime(day.checkOutAt)}` : " — still in"}`
      : "";
    return `${where}${times}`;
  }
  if (day.leave) {
    const label = day.leave.kind === "wfh" ? "Work from home" : `${day.leave.type ? LEAVE_LABELS[day.leave.type] : ""} Leave`.trim();
    return `${label}${day.leave.halfDay ? " · half day" : ""} · ${day.leave.status}`;
  }
  if (day.holiday) return `${day.holiday} — company holiday`;
  if (day.off) return `${day.off} — weekly off`;
  return "No attendance recorded";
}

export default function AttendanceCalendar() {
  const [key, setKey] = useState(() => monthKey(new Date()));
  const [data, setData] = useState<Month | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    getJSON<Month>(`/api/attendance?month=${key}`, "your calendar").then((d) => d && setData(d));
  }, [key]);

  const shift = (by: number) => {
    const d = new Date(`${key}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + by);
    setKey(monthKey(d));
    setPicked(null);
  };

  const day = data?.days.find((d) => d.date === picked);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="eyebrow">{monthLabel(key)}</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {!data ? (<LoadRecovery>
        <Skeleton className="mt-3 h-52 w-full" />
      </LoadRecovery>) : (
        <>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="pb-1 text-[10px] font-medium text-muted-foreground">
                {w}
              </div>
            ))}
            {Array.from({ length: leadingBlanks(key) }, (_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {data.days.map((d) => {
              const isToday = d.date === data.today;
              const isPicked = d.date === picked;
              return (
                <button
                  key={d.date}
                  type="button"
                  aria-label={`${fmtShortDate(`${d.date}T00:00:00`)} — ${dayHeadline(d)}`}
                  aria-pressed={isPicked}
                  onClick={() => setPicked(isPicked ? null : d.date)}
                  className={`flex flex-col items-center gap-1 rounded-lg py-1.5 transition-colors ${
                    isPicked ? "bg-accent" : "hover:bg-accent/50"
                  } ${isToday ? "ring-1 ring-ring/60" : ""}`}
                >
                  <span className={`text-xs tabular-nums ${d.working ? "" : "text-muted-foreground"}`}>
                    {Number(d.date.slice(-2))}
                  </span>
                  <span className={`size-1.5 rounded-full ${dotClass(d)}`} />
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t pt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500" /> present
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-violet-500" /> leave
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-sky-500" /> WFH
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-rose-400" /> holiday
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-muted-foreground/25" /> weekly off
            </span>
          </div>

          {day ? (
            <div className="mt-4 border-t pt-4">
              <SectionHeader title={fmtShortDate(`${day.date}T00:00:00`)} aside={day.working ? undefined : (day.off ?? undefined)} />
              <p className="mt-1 text-sm text-muted-foreground">{dayHeadline(day)}</p>
              {day.present && day.location && (
                <Badge variant="secondary" className="mt-3 text-[10px]">
                  {LOCATION_LABEL[day.location]}
                </Badge>
              )}
            </div>
          ) : (
            <p className="mt-4 border-t pt-4 text-xs text-muted-foreground">
              {data.email
                ? `Tap a day to see it. ${data.workingDays} working days this month.`
                : "Check in once and your days will show up here."}
            </p>
          )}

          {data.upcomingHolidays.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h3 className="eyebrow">Upcoming holidays</h3>
              <ul className="mt-1 divide-y">
                {data.upcomingHolidays.map((h) => (
                  <li key={h.date} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{h.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtShortDate(`${h.date}T00:00:00`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!data.verified && (
            <Empty>
              Sign in with Google to see your leave and WFH days on the calendar too.
            </Empty>
          )}
        </>
      )}
    </>
  );
}

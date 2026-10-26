"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Clock, LogIn, LogOut, MapPin } from "lucide-react";
import { toast } from "sonner";
import AttendanceCalendar from "@/components/attendance-calendar";
import { IconTile, PageHeader, Segmented, SuccessCheck, stagger } from "@/components/kit";
import LeavePanel from "@/components/leave-panel";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { StatefulButton } from "@/components/motion/button/stateful";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getJSON, readError, send } from "@/lib/fetcher";
import { useButtonState } from "@/lib/hooks/use-button-state";
import { fmtTime } from "@/lib/format";
import { LOCATION_LABEL, type LocationTag } from "@/lib/geo";

type Status = {
  count: number;
  email: string | null;
  me: {
    checkedIn: boolean;
    checkInAt: string;
    checkOutAt: string | null;
    location: LocationTag;
  } | null;
};

type Auth = { signedIn: boolean; googleEnabled: boolean; email?: string; name?: string };

// Best-effort geolocation — never blocks check-in. Denied/timed out → null.
const position = () =>
  new Promise<GeolocationPosition | null>((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 7000, maximumAge: 60_000 });
  });

export default function Attendance() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [user, setUser] = useState<Auth | null>(null);
  const [tab, setTab] = useState<"today" | "calendar" | "leave">("today");
  const [buttonState, run] = useButtonState();

  const load = async () => {
    const [data, auth] = await Promise.all([
      getJSON<Status>("/api/attendance", "attendance"),
      getJSON<Auth>("/api/auth/me", "your sign-in"),
    ]);
    if (data) setStatus(data);
    if (auth) setUser(auth);
  };
  useEffect(() => {
    load();
  }, []);

  const mark = (action: "in" | "out") =>
    run(async () => {
      const pos = action === "in" ? await position() : null;
      const res = await send("/api/attendance", {
        method: "POST",
        json: {
          action,
          lat: pos?.coords.latitude ?? null,
          lng: pos?.coords.longitude ?? null,
          accuracyM: pos ? Math.round(pos.coords.accuracy) : null,
        },
      });
      if (!res.ok) {
        const message = await readError(res);
        toast.error(message);
        return false;
      }
      toast.success(action === "in" ? "You're checked in" : "Checked out — see you soon");
      await load();
      return true;
    });

  async function forget() {
    const res = await send("/api/attendance", { method: "DELETE" });
    if (!res.ok) return toast.error(await readError(res));
    router.refresh();
  }

  const me = status?.me;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Attendance" subtitle="Check in, see your month, plan time off." />

      {!status ? (
        <Card className="items-center gap-3 p-8">
          <Skeleton className="size-20 rounded-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="mt-4 h-11 w-full rounded-lg" />
        </Card>
      ) : me ? (
        <Card className="t-stagger items-center gap-0 p-8 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-emerald-50" style={stagger(0)}>
            <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lift">
              <SuccessCheck className="size-7" />
            </span>
          </span>
          <h2 className="mt-5 text-lg font-medium text-emerald-600" style={stagger(1)}>
            {me.checkedIn ? "You're checked in" : "You're checked out"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground" style={stagger(2)}>
            {me.checkedIn
              ? `In since ${fmtTime(me.checkInAt)}`
              : `Out since ${me.checkOutAt ? fmtTime(me.checkOutAt) : ""} — done for today`}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground" style={stagger(3)}>
            <MapPin className="size-4" /> {LOCATION_LABEL[me.location]} • Innovin
          </p>
          <div className="mt-6 w-full" style={stagger(4)}>
            {me.checkedIn ? (
              <StatefulButton
                state={buttonState}
                onClick={() => mark("out")}
                loadingText="Checking out"
                successText="Checked out"
                errorText="Try again"
                icon={<LogOut className="size-4" />}
                className="h-11 w-full rounded-lg font-medium"
              >
                Check Out
              </StatefulButton>
            ) : (
              <StatefulButton
                state={buttonState}
                onClick={() => mark("in")}
                loadingText="Locating & checking in"
                successText="Checked in"
                errorText="Try again"
                icon={<LogIn className="size-4" />}
                className="h-11 w-full rounded-lg font-medium"
              >
                Check In Again
              </StatefulButton>
            )}
          </div>
        </Card>
      ) : (
        <Card className="gap-0 p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mark("in");
            }}
          >
            <div className="flex items-center gap-3">
              <IconTile icon={Clock} tone="blue" size="lg" />
              <div>
                <h2 className="font-medium">Not checked in yet</h2>
                <p className="text-sm text-muted-foreground">Mark your attendance for today.</p>
              </div>
            </div>

            <p className="mt-5 rounded-lg bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
              Checking in as <span className="font-medium text-foreground">{user?.name}</span>{" "}
              <span className="text-xs">({user?.email})</span>
              <Button type="button" variant="link" size="sm" onClick={forget} className="ml-1 h-auto p-0 text-accent-foreground">
                Not you?
              </Button>
            </p>

            <StatefulButton
              type="submit"
              state={buttonState}
              loadingText="Locating & checking in"
              successText="Checked in"
              errorText="Try again"
              icon={<CalendarCheck className="size-4" />}
              className="mt-5 h-11 w-full rounded-lg font-medium"
            >
              Check In
            </StatefulButton>
          </form>
        </Card>
      )}

      {/* One time surface: today's detail, the month calendar, and leave. The check-in action
          above stays put for the verified employee. */}
      <div className="mt-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "today", label: "Today" },
            { value: "calendar", label: "Calendar" },
            { value: "leave", label: "Leave" },
          ]}
        />
      </div>

      {tab === "calendar" && (
        <Card className="mt-4 gap-0 p-5">
          <AttendanceCalendar />
        </Card>
      )}

      {tab === "leave" && (
        <div className="mt-4">
          <LeavePanel rememberedEmail={status?.email ?? null} />
        </div>
      )}

      {tab === "today" && status && (
        <Card className="mt-4 flex-row items-center gap-4 p-5">
          <IconTile icon={CalendarCheck} tone="blue" />
          <div>
            <p className="text-sm font-medium">Today&apos;s summary</p>
            <p className="text-xs text-muted-foreground">
              <AnimatedNumber value={status.count} className="text-base font-medium text-foreground" />{" "}
              {status.count === 1 ? "person" : "people"} checked in today
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

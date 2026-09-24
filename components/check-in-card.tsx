"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Clock, Loader2, LogIn, LogOut, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { IconTile } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getJSON, readError, send } from "@/lib/fetcher";
import { fmtTime } from "@/lib/format";
import { LOCATION_LABEL, type LocationTag } from "@/lib/geo";
import { cn } from "@/lib/utils";

type Status = {
  count: number;
  email: string | null;
  onOfficeNetwork: boolean;
  office: { lat: number; lng: number; radiusM: number } | null;
  me: {
    checkedIn: boolean;
    checkInAt: string;
    checkOutAt: string | null;
    location: LocationTag;
  } | null;
};

export const AUTO_CHECKIN_KEY = "innovin.autoCheckIn";

// Best-effort geolocation — never blocks the action. Denied/timed out → null.
const position = () =>
  new Promise<GeolocationPosition | null>((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 7000, maximumAge: 60_000 });
  });

const withinOffice = (office: Status["office"], lat: number, lng: number) => {
  if (!office) return false;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(office.lat - lat) / 2) ** 2 +
    Math.cos(rad(lat)) * Math.cos(rad(office.lat)) * Math.sin(rad(office.lng - lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h)) <= office.radiusM;
};

// Home's one attendance surface: status, the action itself, and auto check-in when enabled.
// History, the calendar and leave stay on /attendance — today happens here.
export default function CheckInCard({ nextAway }: { nextAway: string | null }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const autoTried = useRef(false);

  const load = async () => {
    const data = await getJSON<Status>("/api/attendance", "attendance");
    if (data) setStatus(data);
    return data;
  };

  const mark = async (action: "in" | "out", pos: GeolocationPosition | null, quiet = false) => {
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
      if (!quiet) toast.error(await readError(res));
      return false;
    }
    return true;
  };

  const checkIn = async () => {
    setBusy(true);
    const pos = await position();
    if (await mark("in", pos)) {
      toast.success("Checked in — have a good one");
      await load();
    }
    setBusy(false);
  };

  const checkOut = async () => {
    setBusy(true);
    if (await mark("out", null)) {
      toast.success("Checked out — see you tomorrow");
      await load();
    }
    setBusy(false);
  };

  useEffect(() => {
    load().then(async (data) => {
      // Auto check-in: once per page load, only when the device opted in and we're sure the
      // person is at the office — either the request came from the office network, or the
      // browser's own fix lands inside the geofence.
      if (autoTried.current || !data || data.me?.checkedIn) return;
      if (localStorage.getItem(AUTO_CHECKIN_KEY) !== "1" || !data.email) return;
      autoTried.current = true;
      if (data.onOfficeNetwork) {
        if (await mark("in", null, true)) {
          toast.success("Checked you in — office Wi-Fi spotted you");
          await load();
        }
        return;
      }
      if (!data.office) return;
      const pos = await position();
      if (pos && withinOffice(data.office, pos.coords.latitude, pos.coords.longitude)) {
        if (await mark("in", pos, true)) {
          toast.success("Checked you in — you're at the office");
          await load();
        }
      }
    });
  }, []);

  if (!status) {
    return (
      <Card className="gap-3 p-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </Card>
    );
  }

  const me = status.me;
  const checkedIn = !!me?.checkedIn;
  const canAct = !!status.email;

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center gap-2">
        <Clock className="size-3.5 text-brand" />
        <h2 className="eyebrow">Attendance</h2>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <IconTile
          icon={me ? (checkedIn ? Check : Clock) : Clock}
          tone={checkedIn ? "green" : me ? "slate" : "blue"}
        />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-medium">
            {!me ? "Not checked in" : checkedIn ? "You're in" : "Done for today"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {checkedIn
              ? `In since ${fmtTime(me!.checkInAt)} · ${LOCATION_LABEL[me!.location]}`
              : me
                ? `Out since ${me.checkOutAt ? fmtTime(me.checkOutAt) : ""} · ${LOCATION_LABEL[me.location]}`
                : canAct
                  ? "One tap and you're marked"
                  : "Set yourself up on Attendance first"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {checkedIn ? (
          <Button onClick={checkOut} disabled={busy} size="xl" className="flex-1">
            {busy ? <Loader2 className="animate-spin" /> : <LogOut />} Check out
          </Button>
        ) : canAct ? (
          <Button onClick={checkIn} disabled={busy} size="xl" className="flex-1">
            {busy ? <Loader2 className="animate-spin" /> : <LogIn />} Check in
          </Button>
        ) : (
          <Button asChild size="xl" className="flex-1">
            <Link href="/attendance">Set up check-in</Link>
          </Button>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-3.5" />
          {status.count === 0 ? "Nobody's in yet" : `${status.count} in today`}
        </span>
        {checkedIn && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" />
            {status.onOfficeNetwork ? "On office Wi-Fi" : LOCATION_LABEL[me!.location]}
          </span>
        )}
        {nextAway && <span className="truncate pl-3">{nextAway}</span>}
      </div>
      <Link href="/attendance" className="mt-3 block text-center text-xs font-medium text-accent-foreground hover:underline">
        Calendar, leave & history →
      </Link>
    </Card>
  );
}

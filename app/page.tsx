import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, CalendarCheck, CalendarDays, CalendarOff, Check, Clock, Coffee, DoorOpen, Megaphone, MessageSquare, Users, Wifi } from "lucide-react";
import { CityArt, WifiArt } from "@/components/art";
import { ArrowLink, Empty, IconTile, MENU_ICONS, QualityDot, SectionHeader, STATUS_META, StatusPill, stagger, type Tone } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { DEVICE_COOKIE, EMAIL_COOKIE, GRIEVANCE_IDS_COOKIE } from "@/lib/cookies";
import { firstName, fmtDay, fmtDuration, fmtShortDate, fmtTime, greeting, relativeDay, relativeTime, totalMinutes } from "@/lib/format";
import { locationTag } from "@/lib/geo";
import { googleConfigured } from "@/lib/google";
import { orderCutoffHour } from "@/lib/config";
import { MENU } from "@/lib/menu";
import { store } from "@/lib/store";
import { awayForDevice, grievanceIdsFromCookie, grievancesFromIds, ordersForDeviceOn } from "@/lib/submitter";
import { istHour, todayIST } from "@/lib/time";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS: { href: string; label: string; icon: LucideIcon; tone: Tone }[] = [
  { href: "/attendance", label: "Attendance", icon: CalendarCheck, tone: "blue" },
  { href: "/snacks", label: "Meals & Snacks", icon: Coffee, tone: "sky" },
  { href: "/grievances", label: "Grievances", icon: MessageSquare, tone: "ink" },
  { href: "/wifi", label: "Wi-Fi Quality", icon: Wifi, tone: "blue" },
];

const firstLine = (text: string) => text.split("\n")[0];

// Each section is its own async component inside a Suspense boundary: the greeting paints
// immediately and each card streams in as its queries resolve instead of blocking the page.

async function YourDay({ email, deviceId }: { email: string | null; deviceId: string | undefined }) {
  const date = todayIST();
  const [sessions, myOrders, todayAll, myAway] = await Promise.all([
    email ? store.listAttendanceByEmail(email, date) : Promise.resolve([]),
    ordersForDeviceOn(deviceId, date),
    store.listAttendance(date),
    awayForDevice(deviceId, 10),
  ]);

  const checkedIn = sessions.some((s) => !s.checkOutAt);
  const openSession = sessions.find((s) => !s.checkOutAt);
  const where = checkedIn ? locationTag(openSession?.lat, openSession?.lng) : null;
  const whereLabel = where === "office" ? "In office" : where === "remote" ? "Remote" : where ? "Location not shared" : null;
  const items = myOrders.map((o) => MENU.find((m) => m.id === o.itemId)).filter((m) => m != null);
  const orderNames = items.map((m) => m.name).join(" + ");
  const ordersOpen = istHour() < orderCutoffHour();

  const tomorrow = new Date(Date.parse(date) + 86_400_000).toISOString().slice(0, 10);
  const nextAway = myAway
    .filter((r) => r.status !== "rejected" && r.endDate >= date)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const awayLabel = !nextAway
    ? "Nothing scheduled"
    : nextAway.status === "pending"
      ? `${nextAway.type === "leave" ? "Leave" : "WFH"} · pending`
      : nextAway.startDate <= date
        ? nextAway.type === "leave"
          ? "On leave today"
          : "WFH today"
        : nextAway.startDate === tomorrow
          ? `${nextAway.type === "leave" ? "Leave" : "WFH"} tomorrow`
          : `${nextAway.type === "leave" ? "Leave" : "WFH"} from ${fmtShortDate(`${nextAway.startDate}T00:00:00`)}`;

  // Count people, not sessions — one open session per person is guaranteed.
  const present = new Map<string, "office" | "remote" | "unknown">();
  for (const s of todayAll) if (!s.checkOutAt) present.set(s.email, locationTag(s.lat, s.lng));
  const inOffice = [...present.values()].filter((t) => t === "office").length;
  const peopleLabel =
    present.size === 0 ? "No one checked in yet" : `${present.size} in today${inOffice ? ` · ${inOffice} in office` : ""}`;

  const dayCells: { href: string; icon: LucideIcon; tone: Tone; label: string; value: string }[] = [
    {
      href: "/attendance",
      icon: CalendarCheck,
      tone: sessions.length ? "green" : "slate",
      label: "Attendance",
      value:
        sessions.length === 0
          ? "Not checked in yet"
          : checkedIn
            ? `${whereLabel ?? "In"} · since ${fmtTime(openSession!.checkInAt)}`
            : `Done · ${fmtDuration(totalMinutes(sessions))} today`,
    },
    {
      href: "/snacks",
      icon: Coffee,
      tone: "sky",
      label: "Meals",
      value: items.length ? orderNames : ordersOpen ? "Not ordered yet" : "Closed for today",
    },
    { href: "/attendance", icon: CalendarOff, tone: "amber", label: "Time away", value: awayLabel },
    { href: "/attendance", icon: Users, tone: "blue", label: "At Innovin", value: peopleLabel },
  ];

  return (
    <div className="t-stagger mt-5">
      <Card className="gap-0 p-5" style={stagger(1)}>
        <SectionHeader title="Your Day" aside={fmtDay()} />
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          {dayCells.map((c) => (
            <Link key={c.label} href={c.href} className="group flex min-w-0 items-center gap-3 rounded-lg p-1 transition-colors hover:bg-muted/60">
              <IconTile icon={c.icon} tone={c.tone} size="sm" className="transition-transform duration-300 group-hover:-translate-y-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                <p className="truncate text-sm font-medium">{c.value}</p>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

async function DayColumn({ email, deviceId }: { email: string | null; deviceId: string | undefined }) {
  const date = todayIST();
  const [sessions, myOrders] = await Promise.all([
    email ? store.listAttendanceByEmail(email, date) : Promise.resolve([]),
    ordersForDeviceOn(deviceId, date),
  ]);

  const checkedIn = sessions.some((s) => !s.checkOutAt);
  const openSession = sessions.find((s) => !s.checkOutAt);
  const where = checkedIn ? locationTag(openSession?.lat, openSession?.lng) : null;
  const whereLabel = where === "office" ? "In office" : where === "remote" ? "Remote" : where ? "Location not shared" : null;
  const items = myOrders.map((o) => MENU.find((m) => m.id === o.itemId)).filter((m) => m != null);
  const orderNames = items.map((m) => m.name).join(" + ");
  const orderTotal = items.reduce((sum, m) => sum + (m.price ?? 0), 0);
  const ordersOpen = istHour() < orderCutoffHour();

  return (
    <div className="flex min-w-0 flex-col gap-5" style={stagger(2)}>
      <Card className="grid gap-0 p-0 sm:grid-cols-[1.1fr_1fr]">
        <div className="relative z-10 p-5">
          <div className="flex min-h-5 items-center gap-2">
            <DoorOpen className="size-3.5 text-brand" />
            <h2 className="eyebrow">Today&apos;s Attendance</h2>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <IconTile icon={sessions.length ? Check : Clock} tone={sessions.length ? "green" : "slate"} />
            <div>
              <p className="text-lg font-medium">
                {sessions.length === 0 ? (
                  "Not checked in"
                ) : checkedIn ? (
                  <>
                    Checked <span className="text-emerald-600">in</span>
                  </>
                ) : (
                  <>
                    Checked <span className="text-emerald-600">out</span>
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {sessions.length === 0
                  ? "Mark your attendance for today"
                  : checkedIn
                    ? `In since ${fmtTime(openSession!.checkInAt)} • ${fmtDuration(totalMinutes(sessions))} today • ${whereLabel}`
                    : `${fmtDuration(totalMinutes(sessions))} today • Innovin`}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <ArrowLink href="/attendance">{sessions.length ? "View details" : "Check in now"}</ArrowLink>
          </div>
        </div>
        <div className="relative hidden min-h-44 sm:block">
          <CityArt className="absolute inset-0" />
          <p className="absolute right-5 top-1/2 max-w-[9rem] -translate-y-1/2 text-right text-sm font-medium leading-snug text-white drop-shadow">
            Great teams build great things.
          </p>
        </div>
      </Card>

      <Card className="gap-0 p-5">
        <SectionHeader title="Quick Actions" />
        <div className="mt-4 grid grid-cols-4">
          {QUICK_ACTIONS.map((a, i) => (
            <div key={a.href} className="flex min-w-0">
              {i > 0 && <Separator orientation="vertical" className="my-2" />}
              <Link
                href={a.href}
                className="group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-lg px-1 py-2 text-center transition-colors hover:bg-muted/60"
              >
                <IconTile icon={a.icon} tone={a.tone} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-active:scale-95" />
                <span className="text-[11px] font-medium leading-tight sm:text-xs">{a.label}</span>
              </Link>
            </div>
          ))}
        </div>
      </Card>

      <Card className="gap-0 p-5">
        <SectionHeader title="Today's Orders" href="/snacks" />
        <div className="mt-4 flex items-center gap-3">
          <IconTile icon={MENU_ICONS[items[0]?.icon ?? "coffee"]} tone={items[0]?.tone ?? "sky"} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{orderNames || "Meals & Snacks"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {items.length
                ? `${orderTotal ? `₹${orderTotal}` : "Ordered"}${myOrders[0]?.instructions ? ` • ${myOrders[0].instructions}` : ""}`
                : ordersOpen
                  ? "Not ordered yet"
                  : "Orders are closed for today"}
            </p>
          </div>
          {ordersOpen && <ArrowLink href="/snacks">{items.length ? "Change" : "Order now"}</ArrowLink>}
        </div>
      </Card>
    </div>
  );
}

async function SocialColumn({ grievanceIds }: { grievanceIds: string[] }) {
  const [announcements, grievances, events] = await Promise.all([
    store.listAnnouncements(2),
    grievancesFromIds(grievanceIds, 3),
    // Events were publishable but invisible here, so nobody saw one without visiting /events.
    store.listEvents(new Date().toISOString(), 2),
  ]);

  return (
    <div className="flex min-w-0 flex-col gap-5" style={stagger(3)}>
      <Card className="gap-0 p-5">
        <SectionHeader
          title="Announcements"
          badge={announcements[0]?.tag}
          aside={announcements[0] ? fmtShortDate(announcements[0].createdAt) : undefined}
        />
        {announcements.length === 0 ? (
          <Empty>No announcements right now.</Empty>
        ) : (
          <ul className="mt-4 space-y-4">
            {announcements.map((a) => (
              <li key={a.id} className="flex gap-3">
                <IconTile icon={Megaphone} tone="blue" size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  {a.body && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{a.body}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="gap-0 p-5">
        <SectionHeader title="What's on" href="/events" linkLabel="All events" />
        {events.length === 0 ? (
          <Empty>Nothing scheduled right now.</Empty>
        ) : (
          <ul className="mt-4 space-y-4">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <IconTile icon={CalendarDays} tone="sky" size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fmtShortDate(e.startsAt)} · {fmtTime(e.startsAt)}
                    {e.location && ` · ${e.location}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex-1 gap-0 p-5">
        <SectionHeader title="Your Grievances" href="/grievances#mine" linkLabel="View all" />
        {grievances.length === 0 ? (
          <div className="py-5 text-center">
            <p className="text-sm text-muted-foreground">Nothing submitted from this device yet.</p>
            <Button asChild variant="link" size="sm" className="mt-1 text-accent-foreground">
              <Link href="/grievances">Share feedback</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-2 divide-y">
            {grievances.map((g) => (
              <li key={g.id} className="flex items-center gap-3 py-3">
                <IconTile icon={MessageSquare} tone={STATUS_META[g.status].tone} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{firstLine(g.body)}</p>
                  <p className="text-xs text-muted-foreground">
                    {relativeTime(g.createdAt)} • {g.displayName ? "With name" : "Anonymous"}
                  </p>
                </div>
                <StatusPill status={g.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

async function WifiColumn() {
  const wifi = await store.listWifi(3);
  const latestWifi = wifi[0];

  return (
    <Card className="gap-0 p-5 lg:col-span-2 xl:col-span-1" style={stagger(4)}>
      <SectionHeader title="Wi-Fi Quality" />
      <div className="mt-4">
        <WifiArt quality={latestWifi?.quality ?? null} />
      </div>
      <p
        className={`mt-3 text-center text-lg font-medium ${
          !latestWifi ? "text-muted-foreground" : latestWifi.quality === "good" ? "text-emerald-600" : "text-rose-600"
        }`}
      >
        {!latestWifi ? "No reports yet" : latestWifi.quality === "good" ? "Good" : "Poor"}
      </p>
      <p className="text-center text-xs text-muted-foreground">
        {latestWifi ? `Reported ${relativeTime(latestWifi.createdAt).toLowerCase()}` : "Tell us how it's working"}
      </p>
      <Button asChild variant="secondary" size="xl" className="mt-4 w-full text-accent-foreground">
        <Link href="/wifi?check=1">Check Speed</Link>
      </Button>
      <p className="mt-5 text-xs font-medium">Recent Reports</p>
      {wifi.length === 0 ? (
        <Empty>Nothing reported yet.</Empty>
      ) : (
        <ul className="mt-1 divide-y">
          {wifi.map((w) => (
            <li key={w.id} className="flex items-center justify-between py-2.5 text-xs text-muted-foreground">
              {relativeDay(w.createdAt)}
              <QualityDot quality={w.quality} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-4">
        <ArrowLink href="/wifi">View details</ArrowLink>
      </div>
    </Card>
  );
}

// Card-shaped skeletons shown while each section's queries resolve.
const CardSkeleton = ({ lines = 2 }: { lines?: number }) => (
  <Card className="gap-3 p-5">
    <Skeleton className="h-3 w-28" />
    <Skeleton className="h-10 w-full" />
    {Array.from({ length: lines - 1 }, (_, i) => (
      <Skeleton key={i} className="h-4 w-3/4" />
    ))}
  </Card>
);

export default async function Home() {
  const jar = await cookies();
  const email = jar.get(EMAIL_COOKIE)?.value ?? null;
  const deviceId = jar.get(DEVICE_COOKIE)?.value;
  const session = verifyUserSession(jar.get(USER_COOKIE)?.value);
  const name = session?.name.split(" ")[0] ?? firstName(email);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="t-stagger">
        <h1 className="text-2xl font-medium tracking-tight" style={stagger(0)}>
          {greeting()}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground" style={stagger(1)}>
          Here&apos;s what&apos;s happening today at Innovin.
        </p>
      </div>

      {!session && googleConfigured() && (
        <Card className="mt-5 flex-row items-center gap-4 p-4">
          <IconTile icon={BadgeCheck} tone="blue" size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Sign in with your Innovin Google account</p>
            <p className="text-xs text-muted-foreground">Verified identity — one tap, no password.</p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <a href="/api/auth/google?next=/">Sign in</a>
          </Button>
        </Card>
      )}

      <Suspense fallback={<div className="mt-5"><CardSkeleton lines={3} /></div>}>
        <YourDay email={email} deviceId={deviceId} />
      </Suspense>

      <div className="t-stagger mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.85fr)]">
        <Suspense fallback={<div className="flex min-w-0 flex-col gap-5"><CardSkeleton lines={3} /><CardSkeleton lines={2} /></div>}>
          <DayColumn email={email} deviceId={deviceId} />
        </Suspense>
        <Suspense fallback={<div className="flex min-w-0 flex-col gap-5"><CardSkeleton lines={2} /><CardSkeleton lines={2} /></div>}>
          <SocialColumn grievanceIds={grievanceIdsFromCookie(jar.get(GRIEVANCE_IDS_COOKIE)?.value)} />
        </Suspense>
        <Suspense fallback={<CardSkeleton lines={4} />}>
          <WifiColumn />
        </Suspense>
      </div>
    </div>
  );
}

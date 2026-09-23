import Link from "next/link";
import { cookies } from "next/headers";
import type { LucideIcon } from "lucide-react";
import { CalendarCheck, Check, Clock, Coffee, DoorOpen, Megaphone, MessageSquare, Wifi } from "lucide-react";
import { CityArt, WifiArt } from "@/components/art";
import { ArrowLink, Empty, IconTile, MENU_ICONS, QualityDot, SectionHeader, STATUS_META, StatusPill, stagger, type Tone } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DEVICE_COOKIE, EMAIL_COOKIE } from "@/lib/cookies";
import { firstName, fmtDuration, fmtShortDate, fmtTime, greeting, relativeDay, relativeTime, totalMinutes } from "@/lib/format";
import { locationTag } from "@/lib/geo";
import { orderCutoffHour } from "@/lib/config";
import { MENU } from "@/lib/menu";
import { store } from "@/lib/store";
import { grievancesForDevice, ordersForDeviceOn } from "@/lib/submitter";
import { istHour, todayIST } from "@/lib/time";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS: { href: string; label: string; icon: LucideIcon; tone: Tone }[] = [
  { href: "/attendance", label: "Attendance", icon: CalendarCheck, tone: "blue" },
  { href: "/snacks", label: "Meals & Snacks", icon: Coffee, tone: "sky" },
  { href: "/grievances", label: "Grievances", icon: MessageSquare, tone: "ink" },
  { href: "/wifi", label: "Wi-Fi Quality", icon: Wifi, tone: "blue" },
];

const firstLine = (text: string) => text.split("\n")[0];

export default async function Home() {
  const jar = await cookies();
  const email = jar.get(EMAIL_COOKIE)?.value ?? null;
  const deviceId = jar.get(DEVICE_COOKIE)?.value;
  const date = todayIST();

  const [sessions, myOrders, announcements, grievances, wifi] = await Promise.all([
    email ? store.listAttendanceByEmail(email, date) : Promise.resolve([]),
    ordersForDeviceOn(deviceId, date),
    store.listAnnouncements(2),
    grievancesForDevice(deviceId, 3),
    store.listWifi(3),
  ]);

  const name = firstName(email);
  const checkedIn = sessions.some((s) => !s.checkOutAt);
  const openSession = sessions.find((s) => !s.checkOutAt);
  const where = checkedIn ? locationTag(openSession?.lat, openSession?.lng) : null;
  const whereLabel = where === "office" ? "In office" : where === "remote" ? "Remote" : where ? "Location not shared" : null;
  const items = myOrders.map((o) => MENU.find((m) => m.id === o.itemId)).filter((m) => m != null);
  const orderNames = items.map((m) => m.name).join(" + ");
  const orderTotal = items.reduce((sum, m) => sum + (m.price ?? 0), 0);
  const ordersOpen = istHour() < orderCutoffHour();
  const latestWifi = wifi[0];

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

      <div className="t-stagger mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.85fr)]">
        {/* Column 1 */}
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

        {/* Column 2 */}
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

        {/* Column 3 */}
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
      </div>
    </div>
  );
}

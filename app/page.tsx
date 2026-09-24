import Link from "next/link";
import { cookies, headers } from "next/headers";
import { Suspense } from "react";
import { BadgeCheck, CalendarDays, Megaphone, Wifi } from "lucide-react";
import { WifiArt } from "@/components/art";
import CheckInCard from "@/components/check-in-card";
import { ArrowLink, Empty, IconTile, QualityDot, SectionHeader, stagger } from "@/components/kit";
import QuickOrder from "@/components/quick-order";
import SpeakUpCard from "@/components/speak-up-card";
import StepsCard from "@/components/steps-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { DEVICE_COOKIE, EMAIL_COOKIE } from "@/lib/cookies";
import { firstName, fmtShortDate, fmtTime, greeting, relativeTime } from "@/lib/format";
import { googleConfigured } from "@/lib/google";
import { store } from "@/lib/store";
import { awayForDevice } from "@/lib/submitter";
import { todayIST } from "@/lib/time";
import { attendanceStatus, snacksMine, stepsBoard } from "@/lib/today";

export const dynamic = "force-dynamic";

const firstLine = (text: string) => text.split("\n")[0];

// Home is the day's action surface: check in, order food, speak up — all without leaving it.
// Everything historical (calendar, order history, submission list) lives one tap away.

// The only attendance surface on this page — the card itself does check-in/check-out.
// The action cards get their data server-side too, so the streamed HTML already shows real
// status instead of every card skeletoning through a second fetch after hydration.
async function TodayColumn({
  deviceId,
  email,
  session,
  ip,
}: {
  deviceId: string | undefined;
  email: string | null;
  session: { email: string; name: string } | null;
  ip: string | null;
}) {
  const date = todayIST();
  const [myAway, attendance, snacks, steps] = await Promise.all([
    awayForDevice(deviceId, 10),
    attendanceStatus(email, ip),
    snacksMine(deviceId),
    stepsBoard(session),
  ]);
  const tomorrow = new Date(Date.parse(date) + 86_400_000).toISOString().slice(0, 10);
  const nextAway = myAway
    .filter((r) => (r.status === "pending" || r.status === "approved") && r.endDate >= date)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const awayLabel = !nextAway
    ? null
    : nextAway.status === "pending"
      ? `${nextAway.type === "leave" ? "Leave" : "WFH"} pending`
      : nextAway.startDate <= date
        ? nextAway.type === "leave"
          ? "On leave today"
          : "WFH today"
        : nextAway.startDate === tomorrow
          ? `${nextAway.type === "leave" ? "Leave" : "WFH"} tomorrow`
          : `${nextAway.type === "leave" ? "Leave" : "WFH"} from ${fmtShortDate(`${nextAway.startDate}T00:00:00`)}`;

  return (
    <div className="flex min-w-0 flex-col gap-5" style={stagger(1)}>
      <CheckInCard nextAway={awayLabel} initial={attendance} />
      <QuickOrder initial={snacks} />
      <StepsCard initial={steps} />
      <SpeakUpCard />
    </div>
  );
}

async function HappeningColumn() {
  const [announcements, events] = await Promise.all([
    store.listAnnouncements(2),
    store.listEvents(new Date().toISOString(), 2),
  ]);

  return (
    <div className="flex min-w-0 flex-col gap-5" style={stagger(2)}>
      <Card className="gap-0 p-5">
        <SectionHeader
          title="Announcements"
          badge={announcements[0]?.tag}
          aside={announcements[0] ? fmtShortDate(announcements[0].createdAt) : undefined}
        />
        {announcements.length === 0 ? (
          <Empty>All quiet for now.</Empty>
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
        <SectionHeader title="What's on" href="/events" linkLabel="All events" />
        {events.length === 0 ? (
          <Empty>Nothing scheduled — the calendar's yours.</Empty>
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
    </div>
  );
}

async function WifiColumn() {
  const wifi = await store.listWifi(3);
  const latestWifi = wifi[0];

  return (
    <Card className="gap-0 p-5 lg:col-span-2 xl:col-span-1" style={stagger(3)}>
      <SectionHeader title="Wi-Fi" />
      <div className="mt-4">
        <WifiArt quality={latestWifi?.quality ?? null} />
      </div>
      <p
        className={`mt-3 text-center text-lg font-medium ${
          !latestWifi ? "text-muted-foreground" : latestWifi.quality === "good" ? "text-emerald-600" : "text-rose-600"
        }`}
      >
        {!latestWifi ? "No word yet" : latestWifi.quality === "good" ? "Flying" : "Crawling"}
      </p>
      <p className="text-center text-xs text-muted-foreground">
        {latestWifi ? `Reported ${relativeTime(latestWifi.createdAt).toLowerCase()}` : "Be the first to report"}
      </p>
      <Button asChild variant="secondary" size="xl" className="mt-4 w-full text-accent-foreground">
        <Link href="/wifi?check=1">Check Speed</Link>
      </Button>
      {wifi.length > 0 && (
        <>
          <p className="mt-5 text-xs font-medium">Recent Reports</p>
          <ul className="mt-1 divide-y">
            {wifi.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2.5 text-xs text-muted-foreground">
                {relativeTime(w.createdAt)}
                <QualityDot quality={w.quality} />
              </li>
            ))}
          </ul>
        </>
      )}
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
  const deviceId = jar.get(DEVICE_COOKIE)?.value;
  const session = verifyUserSession(jar.get(USER_COOKIE)?.value);
  const name = session?.name.split(" ")[0] ?? firstName(jar.get(EMAIL_COOKIE)?.value ?? null);
  const email = session?.email ?? jar.get(EMAIL_COOKIE)?.value ?? null;
  // Same header the API route's clientIp() reads — used only for the office-network check.
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip");

  return (
    <div className="mx-auto max-w-7xl">
      <div className="t-stagger">
        <h1 className="text-2xl font-medium tracking-tight" style={stagger(0)}>
          {greeting()}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground" style={stagger(1)}>
          Today at Innovin — all of it, right here.
        </p>
      </div>

      {!session && googleConfigured() && (
        <Card className="mt-5 flex-row items-center gap-4 p-4">
          <IconTile icon={BadgeCheck} tone="blue" size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Sign in with your Innovin Google account</p>
            <p className="text-xs text-muted-foreground">One tap, no password — unlocks leave balances and your name up top.</p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <a href="/api/auth/google?next=/">Sign in</a>
          </Button>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
        <Suspense fallback={<div className="flex min-w-0 flex-col gap-5"><CardSkeleton lines={4} /><CardSkeleton lines={3} /><CardSkeleton lines={2} /></div>}>
          <TodayColumn deviceId={deviceId} email={email} session={session} ip={ip} />
        </Suspense>
        <Suspense fallback={<div className="flex min-w-0 flex-col gap-5"><CardSkeleton lines={3} /><CardSkeleton lines={2} /></div>}>
          <HappeningColumn />
        </Suspense>
        <Suspense fallback={<CardSkeleton lines={4} />}>
          <WifiColumn />
        </Suspense>
      </div>
    </div>
  );
}

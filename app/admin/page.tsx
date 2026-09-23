import type { LucideIcon } from "lucide-react";
import { CalendarCheck, CalendarDays, Coffee, LogOut, Megaphone, MessageSquare, Trash2, Wifi } from "lucide-react";
import AdminLogin from "@/components/admin-login";
import { Flash } from "@/components/flash";
import AwayList from "@/components/away-list";
import GrievanceList from "@/components/grievance-list";
import { Empty, IconTile, MENU_ICONS, QualityDot, SectionHeader, stagger, type Tone } from "@/components/kit";
import { AnimatedNumber } from "@/components/motion/animated-number";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isAdmin } from "@/lib/admin";
import { leaveAllowanceDays } from "@/lib/config";
import { fmtDay, fmtDuration, fmtShortDate, fmtTime, leaveDays, relativeDay, totalMinutes } from "@/lib/format";
import { locationTag } from "@/lib/geo";
import { MENU } from "@/lib/menu";
import { store } from "@/lib/store";
import { todayIST } from "@/lib/time";

export const dynamic = "force-dynamic";

function Stat({ icon, tone, label, value }: { icon: LucideIcon; tone: Tone; label: string; value: number }) {
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <IconTile icon={icon} tone={tone} />
      <div>
        <AnimatedNumber value={value} className="text-xl font-medium tabular-nums" />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const params = await searchParams;
  if (!(await isAdmin())) {
    const pass = process.env.ADMIN_PASSCODE ?? "";
    return <AdminLogin pinLength={/^\d{4,8}$/.test(pass) ? pass.length : null} initialError={params.error} />;
  }

  const date = todayIST();
  const now = Date.now(); // frozen for hydration — client lists must render the same labels as the server
  const [attendance, orders, grievances, wifi, announcements, employees, away, events] = await Promise.all([
    store.listAttendance(date),
    store.listOrders(date),
    store.listGrievances(),
    store.listWifi(50),
    store.listAnnouncements(10),
    store.listEmployees(),
    store.listAway(50),
    store.listEvents(new Date(Date.now() - 30 * 86_400_000).toISOString(), 30),
  ]);
  const rsvpCounts = await store.rsvpCounts(events.map((e) => e.id));
  const names = new Map(employees.map((e) => [e.email, e.name]));

  const consolidated = MENU.map((m) => ({ ...m, count: orders.filter((o) => o.itemId === m.id).length }));
  const total = consolidated.reduce((sum, m) => sum + m.count * (m.price ?? 0), 0);
  const hasUnpriced = consolidated.some((m) => m.price == null && m.count > 0);
  const openGrievances = grievances.filter((g) => g.status !== "resolved").length;
  const poorToday = wifi.filter((w) => w.quality === "poor" && relativeDay(w.createdAt) === "Today").length;

  // Leave usage this year per person — approved days count against the allowance; WFH doesn't count.
  const year = date.slice(0, 4);
  const allowance = leaveAllowanceDays();
  const leaveByEmail = new Map<string, { used: number; pending: number }>();
  for (const r of away) {
    if (r.type !== "leave" || !r.startDate.startsWith(year) || r.status === "rejected") continue;
    const e = leaveByEmail.get(r.email) ?? { used: 0, pending: 0 };
    e[r.status === "approved" ? "used" : "pending"] += leaveDays(r.startDate, r.endDate);
    leaveByEmail.set(r.email, e);
  }
  const leaveUsage = [...leaveByEmail.entries()].sort((a, b) => b[1].used - a[1].used);

  // One row per employee: their sessions today, total time, and whether they're in right now.
  const people = [...new Set(attendance.map((a) => a.email))].map((email) => {
    const sessions = attendance.filter((a) => a.email === email);
    const open = sessions.find((s) => !s.checkOutAt);
    return { email, sessions, total: totalMinutes(sessions), in: !!open, where: open ? locationTag(open.lat, open.lng) : null };
  });

  return (
    <div className="mx-auto max-w-4xl">
      <Flash done={params.done} />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Admin dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{fmtDay()}</p>
        </div>
        <form action="/api/admin/logout" method="post">
          <Button type="submit" variant="outline" size="lg">
            <LogOut /> Sign out
          </Button>
        </form>
      </div>

      <div className="t-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div style={stagger(0)}>
          <Stat icon={CalendarCheck} tone="blue" label="Checked in today" value={people.length} />
        </div>
        <div style={stagger(1)}>
          <Stat icon={Coffee} tone="sky" label="Orders today" value={orders.length} />
        </div>
        <div style={stagger(2)}>
          <Stat icon={MessageSquare} tone="ink" label="Open grievances" value={openGrievances} />
        </div>
        <div style={stagger(3)}>
          <Stat icon={Wifi} tone="blue" label="Poor Wi-Fi reports today" value={poorToday} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card className="gap-0 p-5">
          <SectionHeader title="Today's orders" aside={`Total ₹${total}${hasUnpriced ? "+" : ""}`} />
          <ul className="mt-3 space-y-2">
            {consolidated.map((c) => (
              <li key={c.id} className="flex items-center gap-3 text-sm">
                <IconTile icon={MENU_ICONS[c.icon]} tone={c.tone} size="sm" />
                <span className="flex-1">{c.name}</span>
                <span className="font-medium tabular-nums">× {c.count}</span>
              </li>
            ))}
          </ul>
          {orders.some((o) => o.instructions) && (
            <div className="mt-4 border-t pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Instructions</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {orders
                  .filter((o) => o.instructions)
                  .map((o) => (
                    <li key={o.id}>
                      • {MENU.find((m) => m.id === o.itemId)?.name}: {o.instructions}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </Card>

        <Card className="gap-0 p-5">
          <SectionHeader title="Attendance" />
          {people.length === 0 ? (
            <Empty>No one has checked in yet.</Empty>
          ) : (
            <ul className="mt-2 divide-y text-sm">
              {people.map((p) => (
                <li key={p.email} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate">{names.get(p.email) ? `${names.get(p.email)} · ` : ""}{p.email}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {p.sessions.length} {p.sessions.length === 1 ? "session" : "sessions"} · {fmtDuration(p.total)}
                      {" · "}
                      {fmtTime(p.sessions[0].checkInAt)} first in
                    </p>
                  </div>
                  {p.in ? (
                    p.where === "remote" ? (
                      <Badge className="shrink-0 bg-amber-50 text-amber-700 hover:bg-amber-50">Remote</Badge>
                    ) : p.where === "office" ? (
                      <Badge className="shrink-0 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">In office</Badge>
                    ) : (
                      <Badge className="shrink-0 bg-sky-50 text-sky-700 hover:bg-sky-50">In · no location</Badge>
                    )
                  ) : (
                    <Badge variant="secondary" className="shrink-0">Out</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4 gap-0 p-5">
        <SectionHeader
          title="Time away"
          aside={away.filter((r) => r.status === "pending").length ? `${away.filter((r) => r.status === "pending").length} pending` : undefined}
        />
        <AwayList items={away} names={Object.fromEntries(names)} now={now} />
        {leaveUsage.length > 0 && (
          <>
            <p className="mt-5 border-t pt-4 text-xs font-medium text-muted-foreground">
              Leave balance · {year} · {allowance} days each
            </p>
            <ul className="mt-1 divide-y">
              {leaveUsage.map(([email, u]) => (
                <li key={email} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate font-medium">{names.get(email) ?? email}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {u.used} used{u.pending ? ` · ${u.pending} pending` : ""} · {Math.max(0, allowance - u.used)} left
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card id="events" className="mt-4 gap-0 p-5">
        <SectionHeader title="Events" aside="Shown on the Events page" />
        <form action="/api/events" method="post" className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input name="title" required maxLength={80} placeholder="Title — e.g. IPL screening in the common area" aria-label="Event title" className="sm:col-span-2" />
          <select
            name="category"
            aria-label="Category"
            className="h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          >
            <option value="sports">Sports</option>
            <option value="arts">Arts</option>
            <option value="culture">Culture</option>
            <option value="learning">Learning</option>
            <option value="social">Social</option>
            <option value="company" selected>
              Company
            </option>
          </select>
          <Input name="startsAt" type="datetime-local" required aria-label="Starts at" />
          <Input name="location" maxLength={60} placeholder="Location (optional)" aria-label="Location" />
          <Textarea name="body" maxLength={500} placeholder="Details (optional)" aria-label="Details" className="resize-none" />
          <Button type="submit" size="xl" className="sm:col-span-2">
            <CalendarDays /> Publish event
          </Button>
        </form>
        {events.length === 0 ? (
          <Empty>No events yet.</Empty>
        ) : (
          <ul className="mt-4 divide-y">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-3 py-3">
                <IconTile icon={CalendarDays} tone="blue" size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {e.title} <Badge variant="secondary" className="ml-1 align-middle">{e.category}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fmtDay(new Date(e.startsAt))} · {fmtTime(e.startsAt)}
                    {e.location && ` · ${e.location}`}
                  </p>
                  {e.body && <p className="mt-0.5 text-xs text-muted-foreground">{e.body}</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                    {(rsvpCounts[e.id] ?? 0) === 0 ? "No RSVPs yet" : `${rsvpCounts[e.id]} going`}
                  </p>
                </div>
                <form id={`event-delete-${e.id}`} action="/api/events" method="post">
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={e.id} />
                </form>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${e.title}`} className="rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                      <AlertDialogDescription>
                        &ldquo;{e.title}&rdquo; and its RSVPs will be removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction type="submit" form={`event-delete-${e.id}`} variant="destructive">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card id="announcements" className="mt-4 gap-0 p-5">
        <SectionHeader title="Announcements" aside="Shown on everyone's home dashboard" />
        <form action="/api/announcements" method="post" className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem]">
          <Input name="title" required maxLength={120} placeholder="Title — e.g. Team Lunch on Friday" aria-label="Title" />
          <Input name="tag" maxLength={30} placeholder="Tag (Office)" aria-label="Tag" />
          <Textarea name="body" maxLength={500} placeholder="Details (optional)" aria-label="Details" className="resize-none sm:col-span-2" />
          <Button type="submit" size="xl" className="sm:col-span-2">
            <Megaphone /> Post announcement
          </Button>
        </form>
        {announcements.length === 0 ? (
          <Empty>No announcements posted.</Empty>
        ) : (
          <ul className="mt-4 divide-y">
            {announcements.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-3">
                <IconTile icon={Megaphone} tone="blue" size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {a.title} <Badge variant="secondary" className="ml-1 align-middle">{a.tag}</Badge>
                  </p>
                  {a.body && <p className="mt-0.5 text-xs text-muted-foreground">{a.body}</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">{fmtShortDate(a.createdAt)}</p>
                </div>
                <form id={`delete-${a.id}`} action="/api/announcements" method="post">
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={a.id} />
                </form>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${a.title}`} className="rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
                      <AlertDialogDescription>
                        &ldquo;{a.title}&rdquo; will be removed from everyone&apos;s home dashboard.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction type="submit" form={`delete-${a.id}`} variant="destructive">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4 gap-0 p-5">
        <SectionHeader title="Grievances" aside={`${openGrievances} need attention`} />
        <GrievanceList items={grievances.map(({ submitterRef: _r, ...g }) => g)} now={now} />
      </Card>

      <Card className="mt-4 gap-0 p-5">
        <SectionHeader title="Wi-Fi reports" />
        {wifi.length === 0 ? (
          <Empty>Nothing reported yet.</Empty>
        ) : (
          <ul className="mt-2 divide-y text-sm">
            {wifi.slice(0, 20).map((w) => (
              <li key={w.id} className="py-2.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {relativeDay(w.createdAt)} · {fmtTime(w.createdAt)}
                    {w.downMbps != null && <span className="opacity-70"> · {w.downMbps} Mbps</span>}
                  </span>
                  <QualityDot quality={w.quality} />
                </div>
                {w.note && <p className="mt-1">{w.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

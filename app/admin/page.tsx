import { attendanceLocation } from "@/lib/presence";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarCheck, CalendarDays, Coffee, LogOut, Megaphone, MessageSquare, Trash2, Wifi } from "lucide-react";
import AccessList from "@/components/access-list";
import AdminLogin from "@/components/admin-login";
import { Flash } from "@/components/flash";
import AwayList from "@/components/away-list";
import PostComposer from "@/components/post-composer";
import LeaveOverview from "@/components/leave-overview";
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
import { currentActor, isAdmin, isOwner } from "@/lib/admin";
import { leaveOverview } from "@/lib/leave-data";
import { fmtDay, fmtShortDate, fmtTime, relativeDay } from "@/lib/format";
import { MENU } from "@/lib/menu";
import { store } from "@/lib/store";
import { todayIST } from "@/lib/time";

export const dynamic = "force-dynamic";

// A stat tile doubles as navigation: tapping it opens the tab that can act on the number.
function Stat({ icon, tone, label, value, href }: { icon: LucideIcon; tone: Tone; label: string; value: number; href: string }) {
  return (
    <Card className="p-0">
      <Link href={href} className="flex flex-row items-center gap-3 rounded-xl p-4 transition-colors hover:bg-accent/40">
        <IconTile icon={icon} tone={tone} />
        <div>
          <AnimatedNumber value={value} className="text-xl font-medium tabular-nums" />
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </Link>
    </Card>
  );
}

const TABS = [
  { id: "today", label: "Today" },
  { id: "approvals", label: "Approvals" },
  { id: "people", label: "People" },
  { id: "publish", label: "Publish" },
] as const;
type Tab = (typeof TABS)[number]["id"];

// Tabs are URL state rather than client state: the dashboard stays a server component, each
// tab is linkable, and only the open tab's data gets queried.
function AdminTabs({ active, pending }: { active: Tab; pending: number }) {
  return (
    <nav aria-label="Dashboard sections" className="mt-4 flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={`/admin?tab=${t.id}`}
          aria-current={t.id === active ? "page" : undefined}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            t.id === active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
          {t.id === "approvals" && pending > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white tabular-nums">{pending}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ done?: string; error?: string; tab?: string }> }) {
  const params = await searchParams;
  if (!(await isAdmin())) {
    const pass = process.env.ADMIN_PASSCODE ?? "";
    return <AdminLogin pinLength={/^\d{4,8}$/.test(pass) ? pass.length : null} initialError={params.error} />;
  }

  const tab: Tab = (TABS.find((t) => t.id === params.tab)?.id ?? "today") as Tab;
  const date = todayIST();
  const year = Number(date.slice(0, 4));
  const now = Date.now(); // frozen for hydration — client lists must render the same labels as the server
  const [actor, owner] = await Promise.all([currentActor(), isOwner()]);

  // Always needed: the stat row, and the pending badge on the Approvals tab.
  const [attendance, orders, grievances, wifi, away, employees] = await Promise.all([
    store.listAttendance(date),
    store.listOrders(date),
    store.listGrievances(),
    store.listWifi(50),
    Promise.all([store.listAway(50), store.listPendingAway()]).then(([history, pending]) => [...pending, ...history.filter(r => r.status !== "pending")]),
    store.listEmployees(),
  ]);

  // Per-tab work stays behind its tab — the leave overview in particular summarises every
  // employee plus everyone in the imported sheet, which is far too much to do on every load.
  const overview = tab === "people" ? await leaveOverview(year, date) : null;
  const events = tab === "publish" ? await store.listEvents(new Date(now - 30 * 86_400_000).toISOString(), 30) : [];
  const [rsvpCounts, announcements] = await Promise.all([
    events.length ? store.rsvpCounts(events.map((e) => e.id)) : Promise.resolve({} as Record<string, number>),
    tab === "publish" ? store.listAnnouncements(10) : Promise.resolve([]),
  ]);
  const names = new Map(employees.map((e) => [e.email, e.name]));

  const consolidated = MENU.map((m) => ({ ...m, count: orders.filter((o) => o.itemId === m.id).length }));
  const total = consolidated.reduce((sum, m) => sum + m.count * (m.price ?? 0), 0);
  const hasUnpriced = consolidated.some((m) => m.price == null && m.count > 0);
  const openGrievances = grievances.filter((g) => g.status !== "resolved").length;
  const poorToday = wifi.filter((w) => w.quality === "poor" && relativeDay(w.createdAt) === "Today").length;
  const pendingAway = away.filter((r) => r.status === "pending").length;

  // One row per employee: in or out today, where, and when they last came in.
  const people = attendance.map((a) => ({
    email: a.email,
    in: !a.checkOutAt,
    where: attendanceLocation(a),
    inAt: a.checkInAt,
    outAt: a.checkOutAt,
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <Flash done={params.done} />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Admin dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {fmtDay()}
            {actor ? ` · ${actor.name || actor.email}` : " · signed in with the shared passcode"}
          </p>
        </div>
        <form action="/api/admin/logout" method="post">
          <Button type="submit" variant="outline" size="lg">
            <LogOut /> End passcode access
          </Button>
        </form>
      </div>

      <div className="t-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div style={stagger(0)}>
          <Stat icon={CalendarCheck} tone="blue" label="Checked in today" value={people.length} href="/admin?tab=today#attendance" />
        </div>
        <div style={stagger(1)}>
          <Stat icon={Coffee} tone="sky" label="Orders today" value={orders.length} href="/admin?tab=today#orders" />
        </div>
        <div style={stagger(2)}>
          <Stat icon={MessageSquare} tone="ink" label="Open reports" value={openGrievances} href="/admin?tab=approvals#grievances" />
        </div>
        <div style={stagger(3)}>
          <Stat icon={Wifi} tone="blue" label="Poor Wi-Fi reports today" value={poorToday} href="/admin?tab=today#wifi" />
        </div>
      </div>

      <AdminTabs active={tab} pending={pendingAway} />

      <div className={`mt-4 grid gap-4 md:grid-cols-2 ${tab === "today" ? "" : "hidden"}`}>
        <Card id="orders" className="gap-0 p-5">
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
          {orders.some((o) => o.orderedBy) && <div className="mt-4 border-t pt-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Employee trays</p><ul className="mt-2 space-y-2 text-sm text-muted-foreground">{[...new Set(orders.flatMap((o) => o.orderedBy ? [o.orderedBy] : []))].map((email) => <li key={email}><span className="font-medium text-foreground">{employees.find((e) => e.email === email)?.name || email}</span><span className="ml-2">{orders.filter((o) => o.orderedBy === email).map((o) => MENU.find((m) => m.id === o.itemId)?.name || o.itemId).join(" + ")}</span></li>)}</ul></div>}
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
                      in {fmtTime(p.inAt)}
                      {p.outAt ? ` · out ${fmtTime(p.outAt)}` : ""}
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

      <Card id="away" className={`mt-4 gap-0 p-5 ${tab === "approvals" ? "" : "hidden"}`}>
        <SectionHeader
          title="Time away"
          aside={away.filter((r) => r.status === "pending").length ? `${away.filter((r) => r.status === "pending").length} pending` : undefined}
        />
        <AwayList items={away} names={Object.fromEntries(names)} now={now} />
      </Card>

      <Card id="leave" className={`mt-4 gap-0 p-5 ${tab === "people" ? "" : "hidden"}`}>
        <SectionHeader title={`Leave balances · ${year}`} aside={overview ? `${overview.people.length} people` : undefined} />
        <p className="mt-1 text-xs text-muted-foreground">
          Zoho People holds the real balances — copy each person’s “Available” figures in here and the app counts
          unreconciled app approvals as estimated adjustments. Mark which approved requests are already reflected in the copied figures. Joining dates drive Earned Leave accrual.
        </p>
        {overview && <LeaveOverview people={overview.people} />}
      </Card>

      {owner && (
        <Card id="access" className={`mt-4 gap-0 p-5 ${tab === "people" ? "" : "hidden"}`}>
          <SectionHeader title="Access" aside="Owner only" />
          <p className="mt-1 text-xs text-muted-foreground">
            Admins get this dashboard when they sign in with Google — their approvals are recorded against their name.
          </p>
          <AccessList people={employees.map((e) => ({ email: e.email, name: e.name, role: e.role }))} />
        </Card>
      )}

      <Card id="events" className={`mt-4 gap-0 p-5 ${tab === "publish" ? "" : "hidden"}`}>
        <SectionHeader title="Post to the team" aside="Announcement or event" />
        <PostComposer />
        <p className="mt-6 border-t pt-4 text-xs font-medium text-muted-foreground">Published events</p>
        
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

      <Card id="announcements" className={`mt-4 gap-0 p-5 ${tab === "publish" ? "" : "hidden"}`}>
        <p className="text-xs font-medium text-muted-foreground">Posted announcements</p>
        
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

      <Card id="grievances" className={`mt-4 gap-0 p-5 ${tab === "approvals" ? "" : "hidden"}`}>
        <SectionHeader title="Speak Up" aside={`${openGrievances} need attention`} />
        <GrievanceList items={grievances.map(({ submitterRef: _r, ...g }) => g)} now={now} />
      </Card>

      <Card id="wifi" className={`mt-4 gap-0 p-5 ${tab === "today" ? "" : "hidden"}`}>
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

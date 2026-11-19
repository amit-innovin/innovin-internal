// "Needs you" for admins: the first thing on the admin app's Today (prototype: docs/design/m3/M3AdminApp.dc.html).
// Leave approvals are deliberately absent — Zoho People decides leave. People behind on their
// office days and the snack order are added by the page from data it already has.
import { mayExist } from "./calendar";
import { store } from "./store";
import { todayIST } from "./time";

export type NeedsYou = { id: string; kind: "speak" | "reported" | "announcement" | "wifi" | "invite"; title: string; sub: string; href: string; urgent: boolean };

const istDay = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3600_000).toISOString().slice(0, 10);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export async function needsYou(): Promise<NeedsYou[]> {
  const today = todayIST();
  const [grievances, wifi, reports, everyone, announcements, invites, tokens] = await Promise.all([
    store.listGrievances(), store.listWifi(100), store.countNoticeReports(), store.listEmployees(), store.listAnnouncements(10), store.listEventInvites(), store.listCalendarTokens(),
  ]);
  const employees = everyone.filter((e) => !e.leftOn);
  const items: NeedsYou[] = [];
  const open = grievances.filter((g) => g.status === "open");
  if (open.length) items.push({ id: "speak", kind: "speak", urgent: open.some((g) => g.urgent), href: "/admin/speak-up", title: plural(open.length, "new Speak up message", "new Speak up messages"), sub: "" });
  // Reported Feed posts waiting for a look.
  const reported = Object.keys(reports).length;
  if (reported) items.push({ id: "reported", kind: "reported", urgent: false, href: "/admin/speak-up", title: plural(reported, "reported Feed post", "reported Feed posts"), sub: "" });
  // Announcements not yet seen by everyone (still showing as a dialog).
  const recent = announcements.filter((a) => (a.pinnedUntil ? a.pinnedUntil >= today : Date.now() - Date.parse(a.createdAt) < 14 * 86_400_000));
  const seen = await store.countAnnouncementAcks(recent.map((a) => a.id));
  for (const a of recent) {
    const n = seen[a.id] ?? 0;
    if (n < employees.length) items.push({ id: `ann-${a.id}`, kind: "announcement", urgent: false, href: "/admin/publish", title: `${a.title} · seen by ${n} of ${employees.length}`, sub: "" });
  }
  // Google invites that need a hand: didn't go out, aren't up to date, a cancel that didn't reach
  // Google (guests still have it), or an organizer who has gone.
  const connected = new Set(tokens.map((t) => t.email));
  const stranded = new Map<string, number>();
  for (const invite of invites) {
    const event = await store.getEvent(invite.eventId);
    if (!event || Date.parse(event.startsAt) <= Date.now()) continue;
    const href = "/admin/publish?tab=events";
    if (invite.state === "sent") {
      if (!event.cancelledAt && !connected.has(invite.owner)) stranded.set(invite.owner, (stranded.get(invite.owner) ?? 0) + 1);
      continue;
    }
    const what = event.cancelledAt ? (mayExist(invite) ? "Cancel didn't reach Google" : null)
      : invite.state === "orphaned" ? "Google invite can't be changed"
      : mayExist(invite) ? "Google invite isn't up to date" : "Google invite didn't go out";
    if (what) items.push({ id: `invite-${event.id}`, kind: "invite", urgent: false, href, title: `${what} · ${event.title}`, sub: "" });
  }
  // A connection Google ended (password change, revoked): that admin's invites can't follow edits.
  for (const owner of stranded.keys()) {
    const name = everyone.find((e) => e.email === owner)?.name || owner;
    items.push({ id: `reconnect-${owner}`, kind: "invite", urgent: false, href: "/admin/publish?tab=events", title: `Reconnect Google Calendar · ${name}'s invites can't be updated`, sub: "" });
  }
  const poor = wifi.filter((w) => w.quality === "poor" && istDay(w.createdAt) === today);
  if (poor.length) items.push({ id: "wifi", kind: "wifi", urgent: false, href: "/admin/wifi", title: `${plural(poor.length, "slow Wi-Fi report", "slow Wi-Fi reports")} today`, sub: "" });
  return items;
}

// The badge on "Speak up" in the member app's admin sub-navigation.
export async function openReports() {
  return (await store.listGrievances()).filter((g) => g.status === "open").length;
}

// Shell props for a signed-in person: admins also get the open-report badge.
export async function shellProps(actor: { name: string; email: string; role: "admin" | "member" }) {
  const isAdmin = actor.role === "admin";
  return { name: actor.name || actor.email, isAdmin, openReports: isAdmin ? await openReports() : 0 };
}

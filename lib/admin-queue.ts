// "Needs you" for admins: the short list on the Account admin card and the admin Overview.
// Leave approvals are deliberately absent — Zoho People decides leave.
import { store } from "./store";
import { todayIST } from "./time";

export type NeedsYou = { id: string; kind: "speak" | "snack" | "wifi"; title: string; sub: string; href: string; urgent: boolean };

// A suggestion this popular is worth an admin's look.
export const POPULAR_SNACK = 3;

const istDay = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3600_000).toISOString().slice(0, 10);

export async function needsYou(): Promise<NeedsYou[]> {
  const today = todayIST();
  const [grievances, snacks, votes, wifi] = await Promise.all([store.listGrievances(), store.listSnacks(), store.listSnackVotes(), store.listWifi(100)]);
  const items: NeedsYou[] = [];
  const open = grievances.filter((g) => g.status === "open");
  const urgent = open.filter((g) => g.urgent);
  if (open.length) {
    items.push({ id: "speak", kind: "speak", urgent: urgent.length > 0, href: "/admin/speak-up",
      title: urgent.length ? `${urgent.length} urgent speak-up report${urgent.length === 1 ? "" : "s"}` : `${open.length} new speak-up report${open.length === 1 ? "" : "s"}`,
      sub: urgent.length && open.length > urgent.length ? `${open.length} open in all` : "Not picked up yet" });
  }
  for (const s of snacks.filter((s) => s.status === "suggested")) {
    const n = votes.filter((v) => v.itemId === s.id).length;
    if (n >= POPULAR_SNACK) items.push({ id: `snack-${s.id}`, kind: "snack", urgent: false, href: "/admin/snacks", title: `${s.name} is popular`, sub: `${n} people want it on the shelf` });
  }
  const poor = wifi.filter((w) => w.quality === "poor" && istDay(w.createdAt) === today);
  if (poor.length) items.push({ id: "wifi", kind: "wifi", urgent: false, href: "/admin/wifi", title: `${poor.length} poor Wi-Fi report${poor.length === 1 ? "" : "s"} today`, sub: poor[0].note || "No location given" });
  return items;
}

// The badge on "Speak up inbox" in the admin sidebar.
export async function openReports() {
  return (await store.listGrievances()).filter((g) => g.status === "open").length;
}

// Shell props for a signed-in person: admins also get the open-report badge.
export async function shellProps(actor: { name: string; email: string; role: "admin" | "member" }) {
  const isAdmin = actor.role === "admin";
  return { name: actor.name || actor.email, isAdmin, openReports: isAdmin ? await openReports() : 0 };
}

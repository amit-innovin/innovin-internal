import type { LucideIcon } from "lucide-react";
import { CalendarCheck, CalendarDays, CalendarOff, Coffee, MessageSquare, Wifi } from "lucide-react";
import { IconTile, PageHeader, stagger, type Tone } from "@/components/kit";
import { Card } from "@/components/ui/card";
import { orderCutoffHour } from "@/lib/config";
import { fmtHour } from "@/lib/format";

// Rendered per request so the cutoff always matches the runtime ORDER_CUTOFF_HOUR the API enforces.
export const dynamic = "force-dynamic";

const faq = (): { icon: LucideIcon; tone: Tone; q: string; a: string }[] => [
  {
    icon: CalendarCheck,
    tone: "blue",
    q: "How does attendance work?",
    a: "Enter your Innovin email once and tap Check In — we remember it on this device. Check out whenever you step out and check in again when you're back; your total time for the day is tracked across sessions. Your browser will ask for your location once per check-in so we can tell office days from remote ones — you can decline and check in anyway.",
  },
  {
    icon: Coffee,
    tone: "sky",
    q: "How do I order food or tea?",
    a:
      orderCutoffHour() >= 24
        ? "Pick what you'd like — tea, snacks, lunch or dinner — and submit anytime. You can change or cancel your order the same day; the coordinator gets one consolidated list."
        : `Pick what you'd like and submit before ${fmtHour(orderCutoffHour())}. You can change your order until the cutoff — the coordinator gets one consolidated list.`,
  },
  {
    icon: MessageSquare,
    tone: "ink",
    q: "Are grievances really anonymous?",
    a: "Yes. Anonymous submissions never show your name or email to anyone, including admins. You can track the status of your own submissions on this device.",
  },
  {
    icon: CalendarOff,
    tone: "amber",
    q: "How do leave and WFH requests work?",
    a: "Open Time Away, pick Leave or Work from home, choose your dates, and send — the coordinator approves or rejects it on the admin dashboard and you can watch the status under Your requests. The Leave balance card tracks your used, pending and remaining leave days for the year. Sign in with Google first so requests come from your verified identity.",
  },
  {
    icon: CalendarDays,
    tone: "rose",
    q: "How do events and RSVPs work?",
    a: "The Events page lists what's coming up — matches, workshops, celebrations, town halls. Tap Join to RSVP so organizers know the headcount; tap again to drop out. Nobody sees who else is going, only the count.",
  },
  {
    icon: Wifi,
    tone: "blue",
    q: "Why report Wi-Fi quality?",
    a: "If nobody flags it, everyone assumes it's fine. Quick Good/Poor reports and speed checks make recurring problems visible so they get fixed.",
  },
];

export default function Help() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Help" subtitle="Quick answers about how Innovin Internal works." />
      <div className="t-stagger space-y-3">
        {faq().map((f, i) => (
          <Card key={f.q} className="flex-row gap-4 p-5" style={stagger(i)}>
            <IconTile icon={f.icon} tone={f.tone} size="sm" />
            <div>
              <h2 className="text-sm font-medium">{f.q}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

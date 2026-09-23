import type { LucideIcon } from "lucide-react";
import { CalendarCheck, CalendarDays, CalendarOff, Coffee, MessageSquare, Plane, Wifi } from "lucide-react";
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
    q: "Is Speak Up really anonymous?",
    a: "Yes. Anonymous reports never show your name or email to anyone, including admins — the database stores no link at all. Mark it Urgent and admins get pinged on their devices. You can track status on this device.",
  },
  {
    icon: CalendarOff,
    tone: "amber",
    q: "How do leave and WFH requests work?",
    a: "Open Attendance and switch to the Leave tab, pick Leave or Work from home, choose the leave type and your dates, and send — the coordinator approves or rejects it on the admin dashboard and you can watch the status under Your requests. Sign in with Google first so requests come from your verified identity.",
  },
  {
    icon: Plane,
    tone: "sky",
    q: "How is my leave balance calculated?",
    a: "The Leave tab in Attendance shows your remaining days for each type — Casual, Sick, Earned and Flexible — for the calendar year. Leave is counted in working days only: Sundays, the 2nd and 4th Saturday, and declared holidays are never charged, so a week off that contains a holiday costs less than five days. Casual Leave can be taken as a half day. Earned Leave builds up at 1.25 days per completed month and can be used after a year of service. Balances follow your verified Google identity, not the device, so sign in to see them. The Calendar tab plots your worked hours, leave, holidays and weekly offs on one month grid.",
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
      <PageHeader title="Help" subtitle="How all of this works, in plain terms." />
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

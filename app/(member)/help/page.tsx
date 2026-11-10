import type { LucideIcon } from "lucide-react";
import { CalendarCheck, CalendarDays, CalendarOff, MessageSquare, Plane, Wifi } from "lucide-react";
import { IconTile, PageHeader, stagger, type Tone } from "@/components/kit";
import { Card } from "@/components/ui/card";
import { fmtHour } from "@/lib/format";

export const dynamic = "force-dynamic";

const faq = (): { icon: LucideIcon; tone: Tone; q: string; a: string }[] => [
  {
    icon: CalendarCheck,
    tone: "blue",
    q: "How does attendance work?",
    a: "Sign in with your Innovin Google account. On Home, choose In office or Remote to record today’s presence; Attendance also has Check In and Check Out. Check out when you leave. Attendance may ask for location, which you can decline. Personal plans do not change attendance.",
  },
  {
    icon: MessageSquare,
    tone: "ink",
    q: "Is Speak Up really anonymous?",
    a: "Yes. Anonymous reports never show your name or email to anyone, including admins — the database stores no link at all. Mark it Urgent to highlight it and attempt an alert to admins with device notifications enabled. You can track status on this device.",
  },
  {
    icon: CalendarOff,
    tone: "amber",
    q: "How do leave requests work?",
    a: "Open Attendance & Leave, pick a leave type, fill the dates and send. An admin approves or rejects the request in this app; its status appears under Your requests. Zoho People remains separate and must be updated there. Personal plans never submit a leave request.",
  },
  {
    icon: Plane,
    tone: "sky",
    q: "How is my leave balance calculated?",
    a: "The Leave tab in Attendance shows your remaining days for each type — Casual, Sick, Earned and Flexible — for the calendar year. Leave is counted in working days only: Sundays, the 2nd and 4th Saturday, and declared holidays are never charged, so non-working dates do not reduce the balance. Casual Leave can be taken as a half day. Earned Leave builds up at 1.25 days per completed month and can be used after a year of service. Balances follow your verified Google identity, not the device, so sign in to see them. The Calendar tab plots your days, leave, holidays and weekly offs on one month grid.",
  },
  {
    icon: CalendarDays,
    tone: "rose",
    q: "How do events and RSVPs work?",
    a: "The Events page lists what's coming up — matches, workshops, celebrations, town halls. Tap Join to RSVP so organizers know the headcount; use Cancel RSVP to drop out. Organizers can click their event title to edit or cancel their own future event. Nobody sees who else is going, only the count.",
  },
  {
    icon: Wifi,
    tone: "blue",
    q: "Why report Wi-Fi quality?",
    a: "If nobody flags it, everyone assumes it's fine. Check Speed measures a download; Good or Poor submits the current note and any measured speed. Measuring alone does not submit a report. Reports help admins spot recurring problems.",
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

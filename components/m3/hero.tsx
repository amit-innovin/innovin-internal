import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Bell, CalendarDays, CircleHelp, Coffee, Footprints, LayoutGrid, Newspaper, Sun, UserRound, Wifi, type LucideIcon } from "lucide-react";
import { SpeakUpIcon } from "@/components/m3/icons";
import type { TimeOfDay } from "@/lib/pace";

export type HeroPage = "home" | "feed" | "days" | "snacks" | "account" | "steps" | "wifi" | "speak" | "notifications" | "help" | "event" | "browse";

// Each section keeps one colour everywhere: its label here, its Pinned card on Today, its charts.
export const CATEGORY: Record<HeroPage, { label: string; color: string; icon: LucideIcon | null }> = {
  home: { label: "Today", color: "var(--m3-primary)", icon: Sun },
  feed: { label: "From the team", color: "#A1401F", icon: Newspaper },
  days: { label: "Office days & leave", color: "var(--m3-tertiary)", icon: CalendarDays },
  snacks: { label: "Tea & snacks", color: "#7A5900", icon: Coffee },
  steps: { label: "Move", color: "var(--m3-success)", icon: Footprints },
  account: { label: "You", color: "var(--m3-primary)", icon: UserRound },
  wifi: { label: "Office Wi-Fi", color: "var(--m3-primary)", icon: Wifi },
  speak: { label: "Anonymous", color: "#C9C6D6", icon: null },
  notifications: { label: "For you", color: "var(--m3-primary)", icon: Bell },
  help: { label: "How innovin works", color: "var(--m3-on-surface-variant)", icon: CircleHelp },
  event: { label: "Event", color: "#A1401F", icon: CalendarDays },
  browse: { label: "Everything in innovin", color: "var(--m3-primary)", icon: LayoutGrid },
};

// Every page's header (design "Today"): a large title in the Apple Health manner, with the
// section's coloured label above it and the page's main action on the right. No illustrated
// band. `back` adds a back arrow on phones, where there are no top tabs. `time` is unused and
// kept so callers don't change.
export function PageHero({ page, title, subtitle, actions, back, children }: {
  page: HeroPage; time?: TimeOfDay; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: string; children?: ReactNode;
}) {
  const cat = CATEGORY[page];
  const Icon = cat.icon;
  return (
    <header className="pg-head" data-page={page}>
      {back && <Link href={back} className="m3-icon-btn m3-back pg-back" aria-label={back === "/" ? "Back to home" : back === "/browse" ? "Back to Browse" : "Back"}><ArrowLeft size={22} aria-hidden="true" /></Link>}
      <div className="pg-head-text">
        <span className="pg-eyebrow" style={{ color: cat.color }}>
          {page === "speak" ? <SpeakUpIcon size={16} /> : Icon && <Icon size={16} strokeWidth={2.2} aria-hidden="true" />}{cat.label}
        </span>
        <h1 className="pg-h1">{title}</h1>
        {subtitle && <span className="pg-sub">{subtitle}</span>}
        {children}
      </div>
      {actions && <div className="pg-actions">{actions}</div>}
    </header>
  );
}


import type { ReactNode } from "react";
import { Bell, CircleHelp, Footprints, LayoutDashboard, Megaphone, Settings, ShieldCheck, Store, Users, Wifi } from "lucide-react";
import { ListRow } from "@/components/m3";
import { SpeakUpIcon } from "@/components/m3/icons";

// Browse (design "Today"): everything that doesn't have a tab of its own, in one list, like
// Apple Health's Browse. Admins also get their tools here; the server still guards every page.

type Item = { href: string; title: string; subtitle: string; icon: ReactNode; tone: string; badge?: number };

const Icon = ({ tone, children }: { tone: string; children: ReactNode }) => <span className={`m3-icon m3-tone-${tone}`}>{children}</span>;

function Group({ title, items }: { title: string; items: Item[] }) {
  return (
    <section aria-label={title} className="td-sec">
      <div className="td-sech"><h2>{title}</h2></div>
      <div className="m3-card" style={{ padding: "4px 0" }}>
        {items.map((i) => (
          <ListRow key={i.href} href={i.href} chevron leading={<Icon tone={i.tone}>{i.icon}</Icon>} title={i.title} subtitle={i.subtitle}
            trailing={i.badge ? <span className="m3-subbadge" aria-label={`${i.badge} open`}>{i.badge}</span> : undefined} />
        ))}
      </div>
    </section>
  );
}

export function BrowsePage({ isAdmin, openReports }: { isAdmin: boolean; openReports: number }) {
  const size = 20;
  return (
    <div className="m3 m3-page m3-stack" style={{ gap: 24 }}>
      <header className="td-title-text">
        <span className="td-eyebrow">Everything in innovin</span>
        <h1 className="td-h1">Browse</h1>
      </header>
      <Group title="Around the office" items={[
        { href: "/steps", title: "10K steps", subtitle: "Your steps, your week and the league", icon: <Footprints size={size} aria-hidden="true" />, tone: "success" },
        { href: "/wifi", title: "Office Wi-Fi", subtitle: "Run a speed check or report slow Wi-Fi", icon: <Wifi size={size} aria-hidden="true" />, tone: "primary" },
        { href: "/notifications", title: "Notifications", subtitle: "Waves, replies and new posts", icon: <Bell size={size} aria-hidden="true" />, tone: "secondary" },
      ]} />
      <Group title="Have your say" items={[
        { href: "/grievances", title: "Speak up", subtitle: "Anonymous. Admins see the day, never you.", icon: <SpeakUpIcon size={size} />, tone: "neutral" },
      ]} />
      <Group title="You" items={[
        { href: "/account", title: "Account & settings", subtitle: "Usual office days, birthday, Say hi", icon: <Settings size={size} aria-hidden="true" />, tone: "neutral" },
        { href: "/help", title: "How innovin works", subtitle: "Office days, leave, tea rounds and privacy", icon: <CircleHelp size={size} aria-hidden="true" />, tone: "neutral" },
      ]} />
      {isAdmin && (
        <Group title="Admin" items={[
          { href: "/admin", title: "Today", subtitle: "Needs you, who's in, tea", icon: <LayoutDashboard size={size} aria-hidden="true" />, tone: "tertiary" },
          { href: "/admin/people", title: "People", subtitle: "Who was in on which day", icon: <Users size={size} aria-hidden="true" />, tone: "tertiary" },
          { href: "/admin/speak-up", title: "Speak up inbox", subtitle: "Messages and reported posts", icon: <ShieldCheck size={size} aria-hidden="true" />, tone: "tertiary", badge: openReports },
          { href: "/admin/publish", title: "Publish", subtitle: "Announcements, events and invites", icon: <Megaphone size={size} aria-hidden="true" />, tone: "tertiary" },
          { href: "/admin/office", title: "Office", subtitle: "Closed days, tea times and the snack shelf", icon: <Store size={size} aria-hidden="true" />, tone: "tertiary" },
          { href: "/admin/wifi", title: "Wi-Fi reports", subtitle: "What people reported, and where", icon: <Wifi size={size} aria-hidden="true" />, tone: "tertiary" },
        ]} />
      )}
    </div>
  );
}

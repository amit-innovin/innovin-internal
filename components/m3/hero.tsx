import type { ReactNode } from "react";
import { HomeScene, PageArt } from "@/components/m3/art";
import type { TimeOfDay } from "@/lib/pace";

export type HeroPage = "home" | "feed" | "days" | "snacks" | "account" | "steps";

const TINT: Record<Exclude<HeroPage, "home">, string> = { feed: "#FFE9D6", days: "#ECE6FB", snacks: "#FFF3CC", account: "#DDF1E4", steps: "#DDF1E4" };
const SKY: Record<TimeOfDay, string> = { morning: "#D6ECFA", afternoon: "#CFE8FB", evening: "#2E3A66" };

// The illustrated band at the top of each main page: a tint for the page, a flat scene on the
// right, the title on the left (never over the art). Detail screens don't get one.
export function PageHero({ page, time = "morning", title, subtitle, actions, children }: {
  page: HeroPage; time?: TimeOfDay; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode;
}) {
  const dark = page === "home" && time === "evening";
  return (
    <header className="m3-hero" data-dark={dark ? "true" : undefined} style={{ background: page === "home" ? SKY[time] : TINT[page] }}>
      {page === "home" ? <HomeScene time={time} /> : <PageArt page={page} />}
      {actions && <div className="m3-hero-actions">{actions}</div>}
      <div className="m3-hero-text">
        <h1 className="m3-h1">{title}</h1>
        {subtitle && <span className="m3-hero-sub">{subtitle}</span>}
        {children}
      </div>
    </header>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { HomeScene, PageArt } from "@/components/m3/art";
import type { TimeOfDay } from "@/lib/pace";

export type HeroPage = "home" | "feed" | "days" | "snacks" | "account" | "steps";

const TINT: Record<Exclude<HeroPage, "home">, string> = { feed: "#FFE9D6", days: "#ECE6FB", snacks: "#FFF3CC", account: "#DDF1E4", steps: "#DDF1E4" };
const SKY: Record<TimeOfDay, string> = { morning: "#D6ECFA", afternoon: "#CFE8FB", evening: "#2E3A66" };

// The illustrated band at the top of each main page: a tint for the page, a flat scene on the
// right, the title on the left (never over the art). Detail screens don't get one.
// `back` puts a phone-only back arrow in the band's top-left corner (detail screens like Steps).
export function PageHero({ page, time = "morning", title, subtitle, actions, back, children }: {
  page: HeroPage; time?: TimeOfDay; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: string; children?: ReactNode;
}) {
  const dark = page === "home" && time === "evening";
  return (
    <header className="m3-hero" data-dark={dark ? "true" : undefined} style={{ background: page === "home" ? SKY[time] : TINT[page] }}>
      {page === "home" ? <HomeScene time={time} /> : <PageArt page={page} />}
      {(back || actions) && (
        <div className="m3-hero-actions" style={back ? { justifyContent: "space-between" } : undefined}>
          {back && <Link href={back} className="m3-hero-btn m3-back" aria-label="Back to home"><ArrowLeft size={22} aria-hidden="true" /></Link>}
          {actions && <span style={{ display: "flex", gap: 4, marginLeft: "auto" }}>{actions}</span>}
        </div>
      )}
      <div className="m3-hero-text">
        <h1 className="m3-h1">{title}</h1>
        {subtitle && <span className="m3-hero-sub">{subtitle}</span>}
        {children}
      </div>
    </header>
  );
}

import { Flat } from "@/components/duo";
import type { DaysView } from "@/lib/days";

const dayLabel = (date: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

// "Office days this month · N of 8": the 8-bar battery shared by Home and Days.
export function Battery({ days }: { days: DaysView }) {
  const { done, target, toGo, status, lastDay } = days.summary;
  if (target === null) return <Flat><span className="duo-sub">You don't have an office-day target this month.</span></Flat>;
  return (
    <section className="duo-battery" aria-label="Office days this month">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 18, fontWeight: 600 }}>Office days this month</span>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 26, fontWeight: 700, color: "var(--duo-gold)" }}>{done}<span style={{ fontSize: 16, color: "var(--duo-hero-muted)" }}> of {target}</span></span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }} aria-hidden="true">
        <div className="duo-bars" style={{ gridTemplateColumns: `repeat(${Math.max(target, 1)}, minmax(0, 1fr))` }}>
          {Array.from({ length: Math.max(target, 1) }, (_, i) => <div key={i} className="duo-bar" data-on={i < done} />)}
        </div>
        <div style={{ width: 8, height: 18, borderRadius: 3, background: "#fff" }} />
      </div>
      <span style={{ fontSize: 13, color: "var(--duo-hero-muted)" }}>
        {status === "done" ? `All ${target} done. Fully charged!` : `${toGo} more to hit your ${target} by ${dayLabel(lastDay)}.`}
      </span>
    </section>
  );
}

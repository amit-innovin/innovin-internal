import type { DaysView } from "@/lib/days";
import { comingUp } from "@/lib/plan";
import { dayNumber, weekdayShort } from "./format";

// Your next planned days. Only yours: no faces or names (owner ruling: no groupism).
export function ComingUp({ view }: { view: DaysView }) {
  const days = comingUp(view);
  return (
    <section aria-labelledby="days-coming" className="m3-stack" style={{ gap: 8 }}>
      <h2 id="days-coming" className="m3-title" style={{ padding: "0 4px" }}>Coming up</h2>
      {days.length === 0 ? (
        <p className="m3-small" style={{ margin: "0 4px" }}>Nothing planned yet. Tap a date on the calendar to plan a day in.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: "0 -16px", padding: "0 16px 4px", display: "flex", gap: 10, overflowX: "auto" }}>
          {days.map((d) => (
            <li key={d.date} className="m3-card" style={{ flex: "none", width: 132, padding: 14, borderRadius: 20, display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="m3-small" style={{ fontWeight: 600 }}>{weekdayShort(d.date)}</span>
              <span style={{ fontSize: 28, lineHeight: "32px", fontWeight: 600 }}>{dayNumber(d.date)}</span>
              <span className="m3-small">{d.usual ? "Your usual day" : "Added by you"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

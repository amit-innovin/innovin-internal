"use client";
import { officeTime } from "@/lib/format";
// Admin › Today: "Needs you" first, then one compact card for the day in the office.
import Link from "next/link";
import { useState } from "react";
import { CalendarX, ChevronRight, Cookie, Flag, Megaphone, ShieldCheck, Wifi, type LucideIcon } from "lucide-react";
import { useAdminOverview, useSnacks, useTea, type AdminData } from "@/lib/queries";
import { Loading, PageHead, dayLabel, fmtTime, todayIST } from "./ui";

type Need = { id: string; title: string; href: string; icon: LucideIcon; tone: [string, string] };
const KIND: Record<AdminData["needsYou"][number]["kind"], [LucideIcon, [string, string]]> = {
  speak: [ShieldCheck, ["#D3E5F5", "#0C1D29"]],
  reported: [Flag, ["#FFDAD6", "#410002"]],
  announcement: [Megaphone, ["#FFDDB0", "#4A2800"]],
  wifi: [Wifi, ["#E5E8EE", "#41474D"]],
  invite: [CalendarX, ["#FFDAD6", "#410002"]],
};

export function TodayPage() {
  const overview = useAdminOverview();
  const snacks = useSnacks();
  const tea = useTea();
  const [names, setNames] = useState(false);
  const head = <PageHead title="Today" sub={`${dayLabel(todayIST(), { weekday: "long" })}, ${dayLabel(todayIST(), { day: "numeric", month: "long" })}`} />;
  const data = overview.data;
  if (!data) return <>{head}<Loading what="today" error={overview.error} onRetry={() => overview.refetch()} /></>;

  const needs: Need[] = data.needsYou.map((n) => ({ id: n.id, title: n.title, href: n.href, icon: KIND[n.kind][0], tone: KIND[n.kind][1] }));
  if (snacks.data && !snacks.data.today.ordered) needs.push({ id: "order", title: `Snack order goes in at ${officeTime(snacks.data.today.orderAt)}`, href: "/admin/office?tab=shelf", icon: Cookie, tone: ["#CDEBD6", "#0B3D1F"] });

  const t = data.tea;
  const nextPm = t.round === "am" && tea.data ? `Afternoon at ${fmtTime(tea.data.times.pm)} · ${tea.data.counts?.pm ?? 0} so far` : null;
  // Names, not counts: who's in today and who's on leave (people marked as left aren't listed).
  const first = (name: string) => name.split(" ")[0];
  const here = data.people.filter((p) => !p.left);
  const who: [string, string, string][] = [
    ["In office", "#006493", here.filter((p) => p.today === "office").map((p) => first(p.name)).join(", ") || "No one yet"],
    ["On leave", "#7D5BA6", here.filter((p) => p.today === "leave").map((p) => first(p.name)).join(", ") || "No one"],
  ];

  return (
    <>
      {head}
      <section aria-label="Needs you" className="m3a-card m3a-narrow" style={{ padding: "6px 0" }}>
        <h2 className="m3-title" style={{ padding: "12px 16px 4px" }}>Needs you</h2>
        {needs.length ? (
          <ul className="m3a-list">
            {needs.map((n) => (
              <li key={n.id}>
                <Link href={n.href} className="m3a-li" style={{ minHeight: 60 }}>
                  <span aria-hidden="true" style={{ flex: "none", width: 40, height: 40, borderRadius: 20, background: n.tone[0], color: n.tone[1], display: "grid", placeItems: "center" }}><n.icon size={20} strokeWidth={1.9} /></span>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{n.title}</span>
                  <ChevronRight size={22} strokeWidth={1.8} color="#41474D" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="m3-body" style={{ margin: 0, padding: "8px 16px 14px", color: "var(--m3-on-surface-variant)" }}>Nothing needs you right now.</p>}
      </section>
      <section aria-label="Today in the office" className="m3a-card m3a-narrow" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {who.map(([label, dot, names]) => (
            <div key={label} style={{ display: "flex", alignItems: "baseline", gap: "6px 12px", flexWrap: "wrap" }}>
              <span className="m3-small" style={{ flex: "none", width: 96, display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--m3-on-surface)" }}><span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 5, background: dot }} />{label}</span>
              <span style={{ flex: 1, minWidth: 180 }}>{names}</span>
            </div>
          ))}
        </div>
        <div className="m3a-topline" style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 180, fontWeight: 600 }}>{t.round === "am" ? "Morning" : "Afternoon"} tea at {fmtTime(t.at)} · {t.count} having tea</span>
            {t.count > 0 && <button type="button" className="m3-btn m3-btn-text" aria-expanded={names} aria-controls="tea-names" onClick={() => setNames(!names)}>{names ? "Hide names" : "Show names"}</button>}
          </div>
          {names && t.count > 0 && <p id="tea-names" className="m3-body" style={{ margin: 0 }}>{t.names.join(", ")}</p>}
          {nextPm && <span className="m3-small">{nextPm}</span>}
        </div>
      </section>
    </>
  );
}

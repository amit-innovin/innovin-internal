"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar, Button, QueryState } from "@/components/m3";
import { PageHero } from "@/components/m3/hero";
import { Lappy } from "@/components/m3/lappy";
import { readError, send } from "@/lib/fetcher";
import { useSteps } from "@/lib/queries";
import { sevenDays } from "@/lib/steps-rules";

const GOAL = 10_000;
const fmt = (n: number) => n.toLocaleString("en-IN");
const weekday = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

function useStepsWrite<T>(url: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: T) => {
      const res = await send(url, { method: "POST", json: input });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["steps"] }),
  });
}

// 10K steps from the Material 3 prototype: your own count and week for everyone; the league
// (with "steps to pass" and once-a-day nudges) only among people who chose to join.
export function StepsPage() {
  const steps = useSteps();
  const add = useStepsWrite<{ add: number }>("/api/steps");
  const league = useStepsWrite<{ on: boolean }>("/api/steps/league");
  const nudge = useStepsWrite<{ email: string }>("/api/steps/nudge");
  const [value, setValue] = useState("");
  const [period, setPeriod] = useState<"week" | "today">("week");
  const data = steps.data;
  if (!data?.me) return <div className="m3 m3-page pg-wide m3-stack"><PageHero page="steps" title="10K steps" /><QueryState error={steps.error} onRetry={() => steps.refetch()} what="your steps" /></div>;

  const today = data.me.today?.steps ?? 0;
  const days = sevenDays(data.me.recent.map((r) => ({ date: r.date, steps: r.steps ?? (r.hit ? GOAL : 0) })), data.today);
  const top = Math.max(GOAL, ...days.map((d) => d.steps));
  const table = data.league ? (period === "week" ? data.league.week : data.league.today) : [];
  const gap = data.league?.nudge[period];
  const leaderSteps = Math.max(1, ...table.map((r) => r.steps));
  const meFirst = table[0]?.me;

  const submit = () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) return toast.error("Enter the steps as a whole number");
    add.mutate({ add: n }, { onSuccess: () => setValue(""), onError: (e) => toast.error(e.message) });
  };

  return (
    <div className="m3 m3-page pg-wide m3-stack">
      <PageHero page="steps" title="10K steps" subtitle="Walk a little more, at your own pace" back="/" />

      <div className="pg-cols">
      <div className="pg-main">
      <section aria-labelledby="steps-today" className="pg-card st-hero">
        <svg aria-hidden="true" className="st-ring" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#DDF1E4" strokeWidth="16" />
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--m3-success)" strokeWidth="16" strokeLinecap="round" opacity={today > 0 ? 1 : 0} strokeDasharray={`${(Math.min(1, today / GOAL) * 314.2).toFixed(1)} 314.2`} transform="rotate(-90 60 60)" style={{ transition: "stroke-dasharray .6s var(--m3-ease)" }} />
        </svg>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <span className="pg-eyebrow" style={{ color: "var(--m3-success)" }}>Today</span>
          <h2 id="steps-today" style={{ margin: 0, fontSize: 44, lineHeight: "48px", fontWeight: 700, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmt(today)} <span className="m3-small" style={{ fontSize: 18, fontWeight: 600 }}>/ 10,000</span></h2>
          <span className="m3-body" style={{ color: "var(--m3-on-surface-variant)" }}>{today >= GOAL ? "Goal reached. Anything more is a bonus." : `${fmt(GOAL - today)} to go today.`}</span>
          <form style={{ display: "flex", gap: 8, alignItems: "flex-end", maxWidth: 420 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="m3-small">Add steps from your phone&apos;s step counter</span>
              <input inputMode="numeric" placeholder="e.g. 2500" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
                style={{ height: 44, borderRadius: 12, border: "1px solid var(--m3-outline)", padding: "0 12px", fontFamily: "inherit", fontSize: 15, background: "var(--m3-surface)" }} />
            </label>
            <Button type="submit" disabled={!value || add.isPending} style={{ height: 44, background: "var(--m3-success)" }}>Add</Button>
          </form>
        </div>
      </section>

      {today >= GOAL && (
        <section className="m3-card" style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--m3-success-container)" }}>
          <Lappy size={52} />
          <span style={{ display: "flex", flexDirection: "column" }}><b>10,000 today</b><span className="m3-small" style={{ color: "inherit" }}>That&apos;s your goal for the day. Anything more is a bonus.</span></span>
        </section>
      )}

      <section aria-labelledby="steps-week" className="pg-card" style={{ gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><h2 id="steps-week" className="m3-title">Last 7 days</h2><span className="m3-small">Goal line: 10,000</span></div>
        <div role="img" aria-label={days.map((d) => `${weekday(d.date)} ${fmt(d.steps)}`).join(", ")} style={{ position: "relative", height: 110, display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8, alignItems: "end" }}>
          <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: `${(100 * GOAL) / top}%`, borderTop: "1px dashed #9AA0A6" }} />
          {days.map((d, i) => <span key={d.date} style={{ height: `${Math.max(3, (100 * d.steps) / top)}%`, borderRadius: 6, background: d.steps >= GOAL ? "var(--m3-success)" : i === 6 ? "#5DAA74" : "#B9DDC4" }} />)}
        </div>
        <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8, textAlign: "center", fontSize: 12 }}>
          {days.map((d, i) => <span key={d.date} style={{ fontWeight: i === 6 ? 700 : 500 }}>{i === 6 ? "Today" : weekday(d.date)}</span>)}
        </div>
      </section>

      </div>
      <aside className="pg-rail">
      {data.inLeague ? (
        <section aria-labelledby="steps-league" className="pg-card" style={{ gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 id="steps-league" className="m3-title">Step league</h2>
            <div role="group" aria-label="Period" style={{ display: "flex", gap: 6 }}>
              {(["week", "today"] as const).map((p) => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={`m3-btn ${period === p ? "m3-btn-tonal" : "m3-btn-text"}`} style={{ height: 32, padding: "0 12px", fontSize: 13 }}>{p === "week" ? "Last 7 days" : "Today"}</button>)}
            </div>
          </div>
          <span className="m3-small">{gap ? `${fmt(gap.steps)} steps to pass ${gap.name} ${period === "week" ? "this week" : "today"}` : meFirst ? "You're leading. Enjoy the view." : table.length ? "" : "Nobody in the league has logged steps yet."}</span>
          {table.map((r, i) => {
            const nudged = data.nudged.includes(r.email);
            return (
              <div key={r.email} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 20, textAlign: "right", fontWeight: 600 }}>{i + 1}</span>
                <Avatar name={r.name} size={32} />
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontWeight: r.me ? 700 : 500 }}>{r.me ? `${r.name} (you)` : r.name}</span><span className="m3-small">{fmt(r.steps)}</span></span>
                  <span aria-hidden="true" style={{ height: 6, borderRadius: 3, background: "#EEF0F3" }}><span style={{ display: "block", height: 6, borderRadius: 3, width: `${(100 * r.steps) / leaderSteps}%`, background: r.me ? "var(--m3-success)" : "#9FD0AE" }} /></span>
                </span>
                {!r.me && (
                  <button type="button" aria-pressed={nudged} aria-label={nudged ? `Nudged ${r.name}` : `Nudge ${r.name}`} disabled={nudged || nudge.isPending}
                    onClick={() => nudge.mutate({ email: r.email }, { onSuccess: () => toast.success(`Nudged ${r.name}`), onError: (e) => toast.error(e.message) })}
                    className={`m3-btn ${nudged ? "m3-btn-tonal" : "m3-btn-outlined"}`} style={{ height: 32, padding: "0 12px", fontSize: 13, flex: "none" }}>{nudged ? "Nudged" : "Nudge"}</button>
                )}
              </div>
            );
          })}
          <p className="m3-small" style={{ margin: 0 }}>A nudge sends one friendly &ldquo;time for a walk?&rdquo; and only to people in the league, at most once a day each. You joined the league; leave it any time here.</p>
          <Button variant="text" style={{ alignSelf: "flex-start" }} disabled={league.isPending} onClick={() => league.mutate({ on: false }, { onError: (e) => toast.error(e.message) })}>Leave the league</Button>
        </section>
      ) : (
        <section aria-labelledby="steps-join" className="pg-card" style={{ gap: 10 }}>
          <h2 id="steps-join" className="m3-title">Step league</h2>
          <p className="m3-body" style={{ margin: 0 }}>See how your week compares with others who joined, and send a friendly nudge. Only people who join are listed, and you can leave any time.</p>
          <Button variant="tonal" style={{ alignSelf: "flex-start" }} disabled={league.isPending} onClick={() => league.mutate({ on: true }, { onError: (e) => toast.error(e.message) })}>Join the league</Button>
        </section>
      )}
      </aside>
      </div>
    </div>
  );
}

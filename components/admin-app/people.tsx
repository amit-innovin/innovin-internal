"use client";
// Admin › People: a searchable list; picking someone opens their panel (month, Fix a day,
// exempt, admin, birthday). Filter and person live in the URL.
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Avatar } from "@/components/m3";
import { Sheet } from "@/components/m3/sheet";
import { useAdminOverview, useAdminPerson, useFixDay, useSetPerson, type PersonMonth, type PersonRow } from "@/lib/queries";
import { Chips, Loading, PageHead, Switch, dayLabel, plural, todayIST, useMe, useSnack } from "./ui";

type Filter = "all" | "behind" | "exempt" | "admin";
type Kind = "in" | "leave" | "closed" | "out" | "none" | "wk";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const KIND_LABEL: Record<Kind, string> = { in: "in office", leave: "leave", closed: "office closed", out: "not in office", none: "nothing marked", wk: "weekend" };
const STATUS: Record<PersonRow["status"], [string, string, string]> = {
  behind: ["Behind", "#FFDDB0", "#4A2800"], "on-track": ["On track", "#CDEBD6", "#0B3D1F"], done: ["On track", "#CDEBD6", "#0B3D1F"], exempt: ["Exempt", "#E5E8EE", "#41474D"],
};
const usual = (p: PersonRow) => (p.exempt ? "Fully remote" : p.schedule === "Not set" ? "Usual days not set" : `Usually ${p.schedule.replace(/ \+ /g, ", ")}`);
const weekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());

function kindOf(d: PersonMonth["days"][number], today: string): Kind {
  if (d.mode === "office") return "in";
  if (d.mode === "leave") return "leave";
  if (!d.working) return weekend(d.date) ? "wk" : "closed";
  return d.date < today ? "out" : "none";
}

function StatusTag({ p }: { p: PersonRow }) {
  const [label, bg, fg] = STATUS[p.status];
  return <span className="m3a-tag" style={{ flex: "none", minWidth: 64, justifyContent: "center", background: bg, color: fg }}>{label}</span>;
}

export function PeoplePage() {
  const overview = useAdminOverview();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const filter = (["all", "behind", "exempt", "admin"] as const).find((f) => f === params.get("show")) ?? "all";
  const selectedEmail = params.get("person");
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key); else next.set(key, value);
    router.replace(`/admin/people${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const data = overview.data;
  const shown = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const pass = (p: PersonRow) => filter === "all" || (filter === "behind" && p.status === "behind") || (filter === "exempt" && p.exempt) || (filter === "admin" && p.role === "admin");
    return data.people.filter((p) => pass(p) && (!needle || p.name.toLowerCase().includes(needle) || p.email.includes(needle)));
  }, [data, q, filter]);

  if (!data) return <><PageHead title="People" /><Loading what="people" error={overview.error} onRetry={() => overview.refetch()} /></>;
  const selected = data.people.find((p) => p.email === selectedEmail) ?? null;
  const count = (f: Filter) => data.people.filter((p) => f === "all" || (f === "behind" && p.status === "behind") || (f === "exempt" && p.exempt) || (f === "admin" && p.role === "admin")).length;

  return (
    <>
      <PageHead title="People" />
      <div className="m3a-cols">
        <div className="m3a-main">
          <section aria-label="Find people" className="m3a-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <label htmlFor="p-q" className="vh">Find people</label>
              <Search size={20} strokeWidth={1.9} color="#41474D" aria-hidden="true" style={{ position: "absolute", left: 14, top: 12 }} />
              <input id="p-q" type="search" className="m3a-field" style={{ paddingLeft: 44, borderRadius: 22 }} placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Chips label="Filter people" value={filter} onPick={(f) => setParam("show", f === "all" ? null : f)}
              options={[["all", `Everyone ${count("all")}`], ["behind", `Behind ${count("behind")}`], ["exempt", `Exempt ${count("exempt")}`], ["admin", `Admins ${count("admin")}`]]} />
          </section>
          <section aria-label="People" className="m3a-card m3a-flush">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "14px 16px 8px" }}><span className="m3-small">{plural(shown.length, "person", "people")}</span><span className="m3-small">This month</span></div>
            <ul className="m3a-list m3a-topline">
              {shown.map((p) => {
                const on = p.email === selectedEmail;
                return (
                  <li key={p.email}>
                    <button type="button" className="m3a-li" aria-current={on ? "true" : undefined} onClick={() => setParam("person", on ? null : p.email)} style={{ minHeight: 64, background: on ? "#E8F1FA" : undefined }}>
                      <Avatar name={p.name} size={36} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontWeight: 600 }}>{p.name}{p.role === "admin" && <span className="m3a-tag" style={{ background: "#D3E5F5", color: "#0C1D29" }}>Admin</span>}{p.left && <span className="m3a-tag" style={{ background: "#E5E8EE", color: "#41474D" }}>Left</span>}</span>
                        <span className="m3-small">{usual(p)}</span>
                      </span>
                      {p.target !== null && <span style={{ flex: "none", minWidth: 36, textAlign: "right", fontWeight: 600 }}><span aria-hidden="true">{p.done}/{p.target}</span><span className="vh">{p.done} of {p.target} office days this month</span></span>}
                      <StatusTag p={p} />
                    </button>
                  </li>
                );
              })}
            </ul>
            {shown.length === 0 && <p className="m3-body" style={{ margin: 0, padding: 16, color: "var(--m3-on-surface-variant)" }}>No one matches. Try another name or filter.</p>}
          </section>
        </div>
        {selected && <PersonPanel key={selected.email} person={selected} month={data.month} onClose={() => setParam("person", null)} />}
      </div>
    </>
  );
}

function PersonPanel({ person, month, onClose }: { person: PersonRow; month: string; onClose: () => void }) {
  const detail = useAdminPerson(person.email, month);
  const setPerson = useSetPerson();
  const snack = useSnack();
  const me = useMe();
  const today = todayIST();
  const [fix, setFix] = useState<{ date: string; where: "in" | "out" | "" } | null>(null);
  const days = detail.data?.days ?? [];
  const lead = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  const monthName = MONTHS[Number(month.slice(5)) - 1];
  const calTitle = `${monthName} · ${person.target === null ? `${person.done} office days (exempt)` : `${person.done} of ${person.target} office days`}`;
  const isSelf = person.email === me.toLowerCase();
  const act = (input: Parameters<typeof setPerson.mutate>[0], ok: string) => setPerson.mutate(input, { onSuccess: () => snack(ok), onError: (e) => snack(e.message) });

  // Birthday: day and month, both or neither.
  const [bdD, setBdD] = useState(person.birthday ? String(Number(person.birthday.slice(3))) : "");
  const [bdM, setBdM] = useState(person.birthday ? String(Number(person.birthday.slice(0, 2))) : "");
  const [bdShow, setBdShow] = useState(person.birthday ? person.showBirthday : true);
  const savedD = person.birthday ? String(Number(person.birthday.slice(3))) : "", savedM = person.birthday ? String(Number(person.birthday.slice(0, 2))) : "";
  const bdBad = !!bdD && !!bdM && Number(bdD) > MAX_DAY[Number(bdM) - 1];
  const bdHalf = !!bdD !== !!bdM;
  const bdChanged = bdD !== savedD || bdM !== savedM || (!!bdD && bdShow !== person.showBirthday);
  const saveBd = () => {
    const birthday = bdD ? `${bdM.padStart(2, "0")}-${bdD.padStart(2, "0")}` : null;
    act({ email: person.email, birthday, showBirthday: bdShow }, birthday ? "Birthday saved" : "Birthday removed");
  };

  return (
    <section aria-labelledby="pp-h" className="m3a-panel">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Avatar name={person.name} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id="pp-h" style={{ margin: 0, fontSize: 22, lineHeight: "28px", fontWeight: 600 }}>{person.name}</h2>
          <span className="m3-small" style={{ overflowWrap: "anywhere" }}>{person.email} · {usual(person).replace(/^Usually/, "usually")}</span>
          <div style={{ paddingTop: 6 }}><StatusTag p={person} /></div>
        </div>
        <button type="button" onClick={onClose} aria-label={`Close ${person.name}`} style={{ flex: "none", width: 48, height: 48, borderRadius: 24, border: 0, background: "transparent", color: "#41474D", display: "grid", placeItems: "center", padding: 0, cursor: "pointer" }}><X size={22} strokeWidth={2} aria-hidden="true" /></button>
      </div>

      <section aria-labelledby="cal-h" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h3 id="cal-h" className="m3-title">{calTitle}</h3>
        <div className="m3a-cal" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => <span key={d} className="m3-small" style={{ fontWeight: i < 5 ? 600 : 400 }}>{d}</span>)}</div>
        <div className="m3a-cal">
          {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
          {days.map((d) => {
            const k = kindOf(d, today);
            const n = Number(d.date.slice(8));
            const fixable = d.date < today && (k === "in" || k === "out");
            const aria = `${n} ${monthName}, ${KIND_LABEL[k]}${d.date === today ? ", today" : ""}`;
            return fixable
              ? <button key={d.date} type="button" className="m3a-cell" data-k={k} aria-label={`${aria}. Fix this day`} onClick={() => setFix({ date: d.date, where: k === "in" ? "out" : "in" })}>{n}</button>
              : <span key={d.date} className="m3a-cell" data-k={k} data-today={d.date === today ? "" : undefined}><span aria-hidden="true">{n}</span><span className="vh">{aria}</span></span>;
          })}
        </div>
        {detail.isPending && <span className="m3-small">Loading the month…</span>}
        <div className="m3-small" style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
          <span className="m3a-key"><i style={{ background: "#006493" }} />In office</span>
          <span className="m3a-key"><i style={{ background: "#EBDCFF", border: "1px solid #7D5BA6" }} />Leave (Zoho)</span>
          <span className="m3a-key"><i style={{ background: "#E5E8EE", border: "1px dashed #71787E" }} />Closed</span>
          <span className="m3a-key"><i style={{ border: "1px solid #C1C7CE" }} />Not in</span>
        </div>
        <span className="m3-small">Click a past weekday to fix it.</span>
        <button type="button" className="m3-btn m3-btn-outlined" style={{ alignSelf: "flex-start" }} onClick={() => setFix({ date: "", where: "" })}>Fix a day</button>
        {!!detail.data?.changes.length && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="m3a-lbl">Change log</span>
            <ul style={{ margin: 0, padding: "0 0 0 18px" }}>
              {detail.data.changes.map((c) => <li key={c.id} className="m3-small">{dayLabel(c.date)} changed to {c.to === "office" ? "In office" : "Not in office"} · by {c.by.split("@")[0]} · {dayLabel(c.at.slice(0, 10), { day: "numeric", month: "short" })}</li>)}
            </ul>
          </div>
        )}
      </section>

      <section aria-label="Rules and access" className="m3a-topline" style={{ margin: "0 -20px" }}>
        <div className="m3a-srow"><span id="ex-l" style={{ flex: 1, fontWeight: 600 }}>Exempt from the 8 days</span>
          <Switch labelledBy="ex-l" on={person.exempt} disabled={setPerson.isPending} onToggle={() => act({ email: person.email, officeExempt: !person.exempt }, person.exempt ? "Exemption removed" : "Marked exempt from the 8 days")} />
        </div>
        <div style={{ height: 1, background: "#DFE3E8", margin: "0 20px" }} />
        <div className="m3a-srow">
          <div style={{ flex: 1, minWidth: 0 }}><span id="ad-l" style={{ display: "block", fontWeight: 600 }}>Admin</span>{isSelf && <span className="m3-small">You can&apos;t remove yourself. Ask another admin.</span>}</div>
          <Switch labelledBy="ad-l" on={person.role === "admin"} disabled={isSelf || setPerson.isPending} onToggle={() => act({ email: person.email, role: person.role === "admin" ? "member" : "admin" }, person.role === "admin" ? "Admin removed" : "Made an admin")} />
        </div>
        <div style={{ height: 1, background: "#DFE3E8", margin: "0 20px" }} />
        <div className="m3a-srow">
          <div style={{ flex: 1, minWidth: 0 }}><span id="lf-l" style={{ display: "block", fontWeight: 600 }}>Left the company</span>{person.left && <span className="m3-small">No calendar invites</span>}</div>
          <Switch labelledBy="lf-l" on={person.left} disabled={isSelf || setPerson.isPending} onToggle={() => act({ email: person.email, left: !person.left }, person.left ? "Marked as back" : "Marked as left")} />
        </div>
      </section>

      <section aria-labelledby="bd-h" className="m3a-topline" style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 18 }}>
        <h3 id="bd-h" className="m3-title">Birthday</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="m3a-fcol" style={{ flex: "1 1 100px" }}><label htmlFor="bd-d" className="m3a-lbl">Day</label>
            <select id="bd-d" aria-label="Birthday day" className="m3a-field" value={bdD} onChange={(e) => setBdD(e.target.value)}>
              <option value="">Not set</option>
              {Array.from({ length: 31 }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}
            </select>
          </div>
          <div className="m3a-fcol" style={{ flex: "2 1 160px" }}><label htmlFor="bd-m" className="m3a-lbl">Month</label>
            <select id="bd-m" aria-label="Birthday month" className="m3a-field" value={bdM} onChange={(e) => setBdM(e.target.value)}>
              <option value="">Not set</option>
              {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}><span id="bd-s" style={{ flex: 1 }}>Show on their birthday in the Feed</span><Switch labelledBy="bd-s" on={bdShow} onToggle={() => setBdShow(!bdShow)} /></div>
        {bdBad && <p role="alert" className="m3a-alert">{MONTHS[Number(bdM) - 1]} doesn&apos;t have {bdD} days.</p>}
        {bdHalf && bdChanged && <p role="alert" className="m3a-alert">Pick both a day and a month, or clear both.</p>}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="m3-btn m3-btn-filled" disabled={!bdChanged || bdBad || bdHalf || setPerson.isPending} onClick={saveBd}>Save birthday</button>
          {(bdD || bdM) && <button type="button" className="m3-btn m3-btn-text" onClick={() => { setBdD(""); setBdM(""); }}>Clear</button>}
        </div>
      </section>

      {fix && <FixDay person={person} days={days} start={fix} onClose={() => setFix(null)} />}
    </section>
  );
}

const yesterday = (today: string) => new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

// The last weekday before today: where Fix a day starts when no day was clicked.
function lastWeekday(today: string) {
  const d = new Date(`${today}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() - 1); while ([0, 6].includes(d.getUTCDay()));
  return d.toISOString().slice(0, 10);
}

function FixDay({ person, days, start, onClose }: { person: PersonRow; days: PersonMonth["days"]; start: { date: string; where: "in" | "out" | "" }; onClose: () => void }) {
  const today = todayIST();
  const [date, setDate] = useState(start.date || lastWeekday(today));
  const [where, setWhere] = useState(start.where);
  const fixDay = useFixDay();
  const snack = useSnack();
  const known = days.find((d) => d.date === date);
  const kind = known ? kindOf(known, today) : null;
  const bad = !date ? "" : date >= today ? "Only past days can be fixed." : weekend(date) ? "That's a weekend." : kind === "closed" ? "The office was closed that day." : kind === "leave" ? "That day is leave from Zoho People. It can only change there." : "";
  const cant = !date || !!bad || !where || kind === where || fixDay.isPending;
  const save = () => fixDay.mutate({ email: person.email, date, mode: where === "in" ? "office" : "none" }, {
    onSuccess: () => { snack(`${dayLabel(date)} changed to ${where === "in" ? "In office" : "Not in office"}`); onClose(); },
    onError: (e) => snack(e.message),
  });
  return (
    <Sheet open onClose={onClose} label="Fix a day">
      <h2 className="m3-title" style={{ fontSize: 22, lineHeight: "28px" }}>Fix a day</h2>
      <span className="m3-small" style={{ marginTop: -8 }}>{person.name}</span>
      <div className="m3a-fcol"><label htmlFor="fx-d" className="m3a-lbl">Date</label><input id="fx-d" type="date" className="m3a-field" max={yesterday(today)} value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <span id="fx-q" className="m3a-lbl">Where were they?</span>
      <div role="radiogroup" aria-labelledby="fx-q" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" role="radio" className="m3a-radio" aria-checked={where === "in"} onClick={() => setWhere("in")}>In office</button>
        <button type="button" role="radio" className="m3a-radio" aria-checked={where === "out"} onClick={() => setWhere("out")}>Not in office</button>
      </div>
      {bad && <p role="alert" className="m3a-alert">{bad}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" className="m3-btn m3-btn-text" onClick={onClose}>Cancel</button>
        <button type="button" className="m3-btn m3-btn-filled" disabled={cant} onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}

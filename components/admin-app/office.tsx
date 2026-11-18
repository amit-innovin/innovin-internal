"use client";
// Admin › Office: closed days, tea and snack times, and the snack shelf, as three tabs (tab in the URL).
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  useAddClosedDay, useClosedDays, useRemoveClosedDay, useSetSnackTimes, useSnacks, useSnackTimes, useSnackWrite, useTea,
  type Snacks, type SnackTimes,
} from "@/lib/queries";
import { Loading, PageHead, Tabs, clockIST, dayLabel, fmtTime, hm, todayIST, useSnack } from "./ui";

type Tab = "closed" | "tea" | "shelf";

export function OfficePage() {
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = (["closed", "tea", "shelf"] as const).find((t) => t === params.get("tab")) ?? "closed";
  return (
    <>
      <PageHead title="Office" />
      <Tabs label="Office settings" value={tab} onPick={(t) => router.replace(t === "closed" ? "/admin/office" : `/admin/office?tab=${t}`, { scroll: false })}
        options={[["closed", "Closed days"], ["tea", "Tea & snack times"], ["shelf", "Snack shelf"]]} />
      {tab === "closed" && <ClosedDays />}
      {tab === "tea" && <TeaTimes />}
      {tab === "shelf" && <Shelf />}
    </>
  );
}

function ClosedDays() {
  const list = useClosedDays();
  const add = useAddClosedDay();
  const remove = useRemoveClosedDay();
  const snack = useSnack();
  const today = todayIST();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const rows = [...(list.data ?? [])].filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const dup = !!date && rows.some((d) => d.date === date);
  const cant = !date || !reason.trim() || dup || add.isPending;
  const submit = () => add.mutate({ date, reason: reason.trim() }, {
    onSuccess: () => { snack(`${dayLabel(date)} marked closed`); setDate(""); setReason(""); },
    onError: (e) => snack(e.message),
  });
  return (
    <div className="m3a-cols">
      <section aria-labelledby="cd-add-h" className="m3a-half m3a-card">
        <h2 id="cd-add-h" className="m3-title">Add a closed day</h2>
        <div className="m3a-fcol"><label htmlFor="cd-date" className="m3a-lbl">Date</label><input id="cd-date" type="date" className="m3a-field" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="m3a-fcol"><label htmlFor="cd-reason" className="m3a-lbl">Reason</label><input id="cd-reason" className="m3a-field" maxLength={120} placeholder="Building maintenance" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        {dup && <p role="alert" className="m3a-alert">That date is already marked closed.</p>}
        {/* Stays available once ordered: a second order that day moves the time on. */}
        <div><button type="button" className="m3-btn m3-btn-filled" disabled={cant} onClick={submit}>Mark closed</button></div>
      </section>
      <section aria-labelledby="cd-list-h" className="m3a-half m3a-card m3a-flush" style={{ gap: 0 }}>
        <h2 id="cd-list-h" className="m3-title" style={{ padding: "16px 20px 8px" }}>Upcoming closed days</h2>
        {list.isError ? <p role="alert" className="m3a-alert" style={{ padding: "0 20px 20px" }}>{list.error.message}</p> : (
          <ul className="m3a-list m3a-topline">
            {rows.map((d) => (
              <li key={d.date} style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 64, padding: "10px 20px", boxSizing: "border-box", flexWrap: "wrap" }}>
                <span aria-hidden="true" style={{ flex: "none", width: 40, height: 40, borderRadius: 20, background: "#E5E8EE", border: "1px dashed #71787E", boxSizing: "border-box", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 600, color: "#41474D" }}>{Number(d.date.slice(8))}</span>
                <div style={{ flex: "1 1 160px", minWidth: 0 }}><div style={{ fontWeight: 600 }}>{dayLabel(d.date)} · {d.reason}</div><div className="m3-small">Added by {d.createdBy.split("@")[0]}</div></div>
                <button type="button" className="m3-btn m3-btn-outlined" aria-label={`Remove ${dayLabel(d.date, { weekday: "long", day: "numeric", month: "long" })}`} disabled={remove.isPending}
                  onClick={() => remove.mutate({ date: d.date }, { onSuccess: () => snack(`${dayLabel(d.date)} removed`), onError: (e) => snack(e.message) })}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        {list.data && rows.length === 0 && <p className="m3-body" style={{ margin: 0, padding: "12px 20px 20px", color: "var(--m3-on-surface-variant)" }}>No closed days coming up.</p>}
      </section>
    </div>
  );
}

const TIME_ROWS: [keyof SnackTimes, string, keyof SnackTimes][] = [["amAt", "Morning tea round", "amClose"], ["pmAt", "Afternoon tea round", "pmClose"]];

function TeaTimes() {
  const saved = useSnackTimes();
  const save = useSetSnackTimes();
  const tea = useTea();
  const snack = useSnack();
  const [draft, setDraft] = useState<SnackTimes | null>(null);
  const [open, setOpen] = useState<{ am: boolean; pm: boolean }>({ am: false, pm: false });
  useEffect(() => { if (saved.data && !draft) setDraft(saved.data); }, [saved.data, draft]);
  if (!saved.data || !draft) return <Loading what="the times" error={saved.error} onRetry={() => saved.refetch()} />;
  const keys = Object.keys(draft) as (keyof SnackTimes)[];
  const changed = keys.some((k) => draft[k] !== saved.data[k]);
  const amBad = !!draft.amAt && !!draft.amClose && draft.amClose >= draft.amAt;
  const pmBad = !!draft.pmAt && !!draft.pmClose && draft.pmClose >= draft.pmAt;
  const empty = keys.some((k) => !draft[k]);
  const cant = !changed || amBad || pmBad || empty || save.isPending;
  const field = (k: keyof SnackTimes, label: string, id: string, bad?: boolean) => (
    <div className="m3a-fcol" style={{ flex: "1 1 150px" }}><label htmlFor={id} className="m3a-lbl">{label}</label><input id={id} type="time" className="m3a-field" aria-invalid={bad || undefined} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} /></div>
  );
  const rounds = (["am", "pm"] as const).map((r) => ({ r, label: r === "am" ? "Morning round" : "Afternoon round", at: saved.data[r === "am" ? "amAt" : "pmAt"], n: tea.data?.counts?.[r] ?? 0, names: tea.data?.names?.[r] ?? [] }));
  return (
    <div className="m3a-cols">
      <section aria-labelledby="times-h" className="m3a-half m3a-card">
        <h2 id="times-h" className="m3-title">Times</h2>
        {TIME_ROWS.map(([at, label, close]) => {
          const bad = at === "amAt" ? amBad : pmBad;
          return (
            <div key={at} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{field(at, label, `t-${at}`)}{field(close, "Answers close", `t-${close}`, bad)}</div>
              {bad && <p role="alert" className="m3a-alert">Answers must close before the round.</p>}
            </div>
          );
        })}
        <div style={{ maxWidth: 320 }}>{field("orderAt", "Snack order goes in", "t-order")}</div>
        {/* Stays available once ordered: a second order that day moves the time on. */}
        <div><button type="button" className="m3-btn m3-btn-filled" disabled={cant} onClick={() => save.mutate(draft, { onSuccess: () => snack("Times saved"), onError: (e) => snack(e.message) })}>Save times</button></div>
      </section>
      <section aria-labelledby="ttoday-h" className="m3a-half m3a-card m3a-flush" style={{ gap: 0 }}>
        <h2 id="ttoday-h" className="m3-title" style={{ padding: "16px 20px 8px" }}>Today</h2>
        <ul className="m3a-list m3a-topline">
          {rounds.map(({ r, label, at, n, names }) => (
            <li key={r} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", minHeight: 40 }}>
                <div style={{ flex: 1, minWidth: 180, fontWeight: 600 }}>{label} at {fmtTime(at)}: {n} having tea</div>
                {n > 0 && <button type="button" className="m3-btn m3-btn-text" aria-expanded={open[r]} aria-controls={`names-${r}`} onClick={() => setOpen({ ...open, [r]: !open[r] })}>{open[r] ? "Hide names" : "Show names"}</button>}
              </div>
              {open[r] && n > 0 && <p id={`names-${r}`} className="m3-body" style={{ margin: 0, color: "var(--m3-on-surface-variant)" }}>{names.join(", ")}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type ShelfAction = { id: string; action: "add" | "dismiss" | "remove" };

function Shelf() {
  const snacks = useSnacks();
  const act = useSnackWrite<ShelfAction>("PATCH");
  const order = useSnackWrite<{ action: "order-placed" }>("PATCH");
  const stock = useSnackWrite<{ name: string; shelf: true }>("POST");
  const snack = useSnack();
  const [tab, setTab] = useState<"ideas" | "shelf">("ideas");
  const [name, setName] = useState("");
  if (!snacks.data) return <Loading what="the snack shelf" error={snacks.error} onRetry={() => snacks.refetch()} />;
  const data: Snacks = snacks.data;
  const picks = data.shelf.map((s) => ({ name: s.name, n: data.today.picks?.find((p) => p.itemId === s.id)?.count ?? 0 })).filter((p) => p.n > 0).sort((a, b) => b.n - a.n);
  const ordered = data.today.ordered;
  const newName = name.trim();
  const dup = !!newName && data.shelf.some((s) => s.name.toLowerCase() === newName.toLowerCase());
  const run = (a: ShelfAction, ok: string) => act.mutate(a, { onSuccess: () => snack(ok), onError: (e) => snack(e.message) });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640, width: "100%" }}>
      <section aria-labelledby="ord-h" className="m3a-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h2 id="ord-h" className="m3-title">Today&apos;s order</h2>
          {ordered
            ? <span className="m3a-tag" style={{ background: "#CDEBD6", color: "#0B3D1F" }}>Ordered{data.today.orderedAt ? ` at ${clockIST(data.today.orderedAt)}` : ""}</span>
            : <span className="m3a-tag" style={{ background: "#FFDDB0", color: "#4A2800" }}>Goes in at {hm(data.today.orderAt)}</span>}
        </div>
        {picks.length > 0 && <ul className="m3a-list">{picks.map((p) => <li key={p.name} style={{ padding: "10px 0", fontSize: 16 }}>{p.name} · {p.n}</li>)}</ul>}
        {/* Stays available once ordered: a second order that day moves the time on. */}
        <div><button type="button" className="m3-btn m3-btn-filled" disabled={order.isPending} onClick={() => order.mutate({ action: "order-placed" }, { onError: (e) => snack(e.message) })}>Mark ordered</button></div>
      </section>
      <section aria-label="Suggestions and shelf" className="m3a-card m3a-flush">
        <Tabs label="Suggestions and shelf" value={tab} onPick={setTab} style={{ padding: "0 8px" }} options={[["ideas", `Suggestions · ${data.suggestions.length}`], ["shelf", `Shelf · ${data.shelf.length}`]]} />
        {tab === "ideas" ? (
          <div role="tabpanel" aria-label="Suggestions">
            <ul className="m3a-list">
              {data.suggestions.map((x) => (
                <li key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 60, padding: "8px 12px 8px 20px", boxSizing: "border-box", flexWrap: "wrap" }}>
                  <span style={{ flex: "1 1 120px" }}>{x.name}</span>
                  <span className="m3-small" style={{ fontWeight: 600, color: "var(--m3-on-surface)" }}><span aria-hidden="true">+{x.votes}</span><span className="vh">{x.votes} {x.votes === 1 ? "person asked" : "people asked"} for this</span></span>
                  <button type="button" className="m3-btn m3-btn-tonal" style={{ height: 36, padding: "0 14px" }} aria-label={`Add ${x.name} to the shelf`} disabled={act.isPending} onClick={() => run({ id: x.id, action: "add" }, `${x.name} added to the shelf`)}>Add to shelf</button>
                  <button type="button" className="m3-btn m3-btn-text" style={{ height: 36 }} aria-label={`Dismiss ${x.name}`} disabled={act.isPending} onClick={() => run({ id: x.id, action: "dismiss" }, `${x.name} dismissed`)}>Dismiss</button>
                </li>
              ))}
            </ul>
            {data.suggestions.length === 0 && <p className="m3-body" style={{ margin: 0, padding: "16px 20px 20px", color: "var(--m3-on-surface-variant)" }}>No new suggestions.</p>}
          </div>
        ) : (
          <div role="tabpanel" aria-label="Shelf">
            <ul className="m3a-list">
              {data.shelf.map((x) => (
                <li key={x.id} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "6px 12px 6px 20px", boxSizing: "border-box" }}>
                  <span style={{ flex: 1 }}>{x.name}</span>
                  <button type="button" className="m3-btn m3-btn-text" aria-label={`Remove ${x.name}`} disabled={act.isPending} onClick={() => run({ id: x.id, action: "remove" }, `${x.name} taken off the shelf`)}>Remove</button>
                </li>
              ))}
            </ul>
            {data.shelf.length === 0 && <p className="m3-body" style={{ margin: 0, padding: "12px 20px", color: "var(--m3-on-surface-variant)" }}>The shelf is empty.</p>}
            <div className="m3a-topline" style={{ display: "flex", gap: 8, padding: "12px 20px 16px", alignItems: "flex-end" }}>
              <div className="m3a-fcol" style={{ flex: 1 }}><label htmlFor="sh-new" className="m3a-lbl">Add a snack</label><input id="sh-new" className="m3a-field" maxLength={60} placeholder="Roasted chana" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <button type="button" className="m3-btn m3-btn-outlined" style={{ height: 44, flex: "none" }} disabled={!newName || dup || stock.isPending}
                onClick={() => stock.mutate({ name: newName, shelf: true }, { onSuccess: () => { setName(""); snack(`${newName} added to the shelf`); }, onError: (e) => snack(e.message) })}>Add</button>
            </div>
            {dup && <p role="alert" className="m3a-alert" style={{ padding: "0 20px 16px" }}>That&apos;s already on the shelf.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

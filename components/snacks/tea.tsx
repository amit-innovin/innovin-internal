"use client";
import { Coffee } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/m3";
import { TeaLappy } from "@/components/m3/art";
import { TeaError, useAnswerTea, type Tea } from "@/lib/queries";
import { officeTime } from "@/lib/format";

// Office times as people say them ("11 am", "3:30 pm"). Shared by Snacks, Today and admin.
export const clock = officeTime;

// What the tea card says for the current round and your answer. Shared by Snacks and Home.
export function teaCopy(tea: Tea) {
  const r = tea.round;
  if (!r) return null;
  const at = clock(r.at), close = clock(r.closesAt);
  const title = tea.mine ? (r.open ? "You're on the tea list" : "Tea's on its way") : `Tea round at ${at}`;
  const line = !r.open ? (tea.mine ? `Coming at ${at}.` : `The ${at} round is closed.`)
    : tea.mine === true ? `You're on the list. You can change your answer until ${close}.`
    : tea.mine === false ? "Skipping this round."
    : `Answer by ${close}.`;
  const another = r.id === "am" ? `There's another round at ${clock(tea.times.pm)}.` : null;
  return { round: r, at, title, line, another, canAnswer: r.open && tea.mine === null, canChange: r.open && tea.mine !== null, lappy: tea.mine === true };
}

export function TeaActions({ tea, compact }: { tea: Tea; compact?: boolean }) {
  const answer = useAnswerTea();
  const copy = teaCopy(tea);
  if (!copy) return null;
  // A round that closed (or moved on) while the page was open isn't an error: the refetch shows it.
  const send = (going: boolean | null) => answer.mutate({ round: copy.round.id, going }, { onError: (e) => { if (!(e instanceof TeaError && (e.code === "closed" || e.code === "wrong-round"))) toast.error(e.message); } });
  const h = compact ? 36 : 44;
  if (copy.canAnswer) return (
    <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Button style={{ height: h, padding: "0 18px", background: compact ? undefined : "#7A5900" }} disabled={answer.isPending} onClick={() => send(true)}>Yes, I&apos;ll have tea</Button>
      <Button variant="text" style={{ height: h, color: compact ? undefined : "#7A5900" }} disabled={answer.isPending} onClick={() => send(false)}>Skip</Button>
    </span>
  );
  if (copy.canChange) return <Button variant="text" style={{ alignSelf: "flex-start", height: 32, padding: 0, color: compact ? undefined : "#7A5900" }} disabled={answer.isPending} onClick={() => send(null)}>Change answer</Button>;
  return null;
}

// The Snacks tab's tea card: the round's time as a big amber block, then your answer. Nothing
// once the day's rounds are done.
export function TeaCard({ tea }: { tea: Tea }) {
  const copy = teaCopy(tea);
  if (!copy) return null;
  return (
    <section aria-labelledby="tea-h" className="pg-card" style={{ flexDirection: "row", alignItems: "center", gap: 20, padding: 20 }}>
      <span aria-hidden="true" style={{ flex: "none", width: 96, height: 96, borderRadius: 24, background: "#FFF3CC", color: "#5C4300", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        {copy.lappy ? <TeaLappy size={52} /> : <><Coffee size={26} /><b style={{ fontSize: 16 }}>{copy.at}</b></>}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 id="tea-h" className="m3-title" style={{ fontSize: 20, lineHeight: "26px" }}>{copy.title}</h2>
          <span className="m3-body" style={{ color: "var(--m3-on-surface-variant)" }}>{copy.line}</span>
        </span>
        <TeaActions tea={tea} />
        {copy.another && <span className="m3-small">{copy.another}</span>}
      </span>
    </section>
  );
}

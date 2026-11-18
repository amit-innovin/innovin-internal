"use client";
import { toast } from "sonner";
import { Button } from "@/components/m3";
import { TeaLappy } from "@/components/m3/art";
import { TeaError, useAnswerTea, type Tea } from "@/lib/queries";

// "11:00", "3:30", "4 PM": the prototype's way of saying office times.
export function clock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 || 12;
  return m === 0 && h >= 12 ? `${h12} PM` : `${h12}:${String(m).padStart(2, "0")}`;
}

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
      <Button style={{ height: h, padding: "0 18px", background: compact ? undefined : "#65587B" }} disabled={answer.isPending} onClick={() => send(true)}>Yes, I&apos;ll have tea</Button>
      <Button variant="text" style={{ height: h, color: compact ? undefined : "#65587B" }} disabled={answer.isPending} onClick={() => send(false)}>Skip</Button>
    </span>
  );
  if (copy.canChange) return <Button variant="text" style={{ alignSelf: "flex-start", height: 32, padding: 0, color: compact ? undefined : "#65587B" }} disabled={answer.isPending} onClick={() => send(null)}>Change answer</Button>;
  return null;
}

// The Snacks tab's tea card (violet, as drawn). Nothing once the day's rounds are done.
export function TeaCard({ tea }: { tea: Tea }) {
  const copy = teaCopy(tea);
  if (!copy) return null;
  return (
    <section aria-labelledby="tea-h" className="m3-card m3-stack" style={{ background: "#EBDCFF", color: "#20142F", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {copy.lappy && <TeaLappy size={52} />}
        <span style={{ display: "flex", flexDirection: "column" }}>
          <h2 id="tea-h" className="m3-title" style={{ fontSize: 18 }}>{copy.title}</h2>
          <span style={{ fontSize: 14 }}>{copy.line}</span>
        </span>
      </div>
      <TeaActions tea={tea} />
      {copy.another && <span style={{ fontSize: 13 }}>{copy.another}</span>}
    </section>
  );
}

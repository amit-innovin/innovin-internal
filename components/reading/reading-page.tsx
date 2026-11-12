"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, PageHeader, QueryState, Split } from "@/components/duo";
import { BellLink } from "@/components/duo/bell";
import { Celebrate } from "@/components/duo/celebrate";
import { Lappy } from "@/components/duo/lappy";
import { Sheet } from "@/components/duo/sheet";
import { useReading, useSend, type Reading } from "@/lib/queries";

type Act = { bookId: string; action: "want" | "unwant" | "start" | "progress" | "finish" | "stop"; pages?: number };
const useAct = () => useSend<Act, Reading>(["reading"], "/api/reading", "PATCH", { replace: true });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function ReadingNow({ current, onFinished }: { current: NonNullable<Reading["current"]>; onFinished: (title: string) => void }) {
  const act = useAct();
  return (
    <section aria-label="Reading now" style={{ background: "var(--duo-grape)", color: "var(--duo-grape-text)", borderRadius: 24, padding: "16px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flexShrink: 0 }}><Lappy pose="read" width={110} /></div>
      <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="duo-tag" style={{ color: "inherit" }}>Reading now</span>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>{current.title}</span>
        {current.author && <span style={{ fontSize: 14, fontWeight: 800 }}>{current.author}</span>}
        <span style={{ display: "flex", fontSize: 13, fontWeight: 800 }}><span style={{ flexGrow: 1 }}>Page {current.page} of {current.pages}</span><span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 700 }}>{current.pct}%</span></span>
        <span role="progressbar" aria-label="Progress" aria-valuenow={current.pct} aria-valuemin={0} aria-valuemax={100} style={{ height: 12, borderRadius: 6, background: "#fff", overflow: "hidden", display: "block" }}>
          <span style={{ display: "block", height: "100%", width: `${current.pct}%`, background: "var(--duo-grape-edge)", borderRadius: 6, transition: "width .4s" }} />
        </span>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
          <Button variant="ghost" disabled={act.isPending || current.page >= current.pages} style={{ minHeight: 44, border: "none", color: "var(--duo-grape-text)", boxShadow: "0 4px 0 var(--duo-grape-edge)" }}
            onClick={() => act.mutate({ bookId: current.bookId, action: "progress", pages: 20 }, { onError: (e) => toast.error(e.message) })}>+20 pages</Button>
          <Button disabled={act.isPending} style={{ minHeight: 44 }}
            onClick={() => act.mutate({ bookId: current.bookId, action: "finish" }, { onSuccess: () => onFinished(current.title), onError: (e) => toast.error(e.message) })}><Check size={18} aria-hidden="true" />Finished it!</Button>
        </div>
      </div>
    </section>
  );
}

function StartSheet({ book, onClose }: { book: Reading["shelf"][number]; onClose: () => void }) {
  const [pages, setPages] = useState("");
  const act = useAct();
  return (
    <Sheet label={`Start ${book.title}`} onClose={onClose}>
      <form style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={(e) => { e.preventDefault(); act.mutate({ bookId: book.id, action: "start", pages: Number(pages) }, { onSuccess: () => { toast.success(`Happy reading!`); onClose(); }, onError: (err) => toast.error(err.message) }); }}>
        <h2 className="duo-h2">Start “{book.title}”</h2>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="duo-label">How many pages does it have?</span>
          <input className="duo-input" inputMode="numeric" autoFocus value={pages} onChange={(e) => setPages(e.target.value.replace(/\D/g, ""))} placeholder="320" />
        </label>
        <span className="duo-sub" style={{ fontSize: 13 }}>One book at a time: anything you were reading goes back on your list.</span>
        <Button type="submit" disabled={act.isPending || !pages}>Start reading</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </form>
    </Sheet>
  );
}

function ShelfCard({ book, onStart }: { book: Reading["shelf"][number]; onStart: () => void }) {
  const act = useAct();
  const want = book.want;
  const label = book.mine === "reading" ? "Reading now" : book.mine === "done" ? "Read it" : book.mine === "want" ? "On your list" : "Want to read";
  return (
    <Card style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden="true" className="duo-tone-grape" style={{ width: 44, height: 54, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><BookOpen size={20} /></span>
        <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--duo-display)", fontSize: 16, fontWeight: 600, lineHeight: 1.15 }}>{book.title}</span>
          {book.author && <span className="duo-sub" style={{ fontSize: 12 }}>{book.author}</span>}
        </span>
      </div>
      <span className="duo-sub" style={{ fontSize: 12 }}>{book.read} read it · {plural(want, "wants", "want")} to read</span>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant={book.mine === "want" ? "primary" : "ghost"} aria-pressed={book.mine === "want"} disabled={act.isPending || book.mine === "reading" || book.mine === "done"}
          style={{ flexGrow: 1, minHeight: 42, fontSize: 15, ...(book.mine === "want" ? { background: "var(--duo-sky)", color: "var(--duo-brand)", border: "2.5px solid var(--duo-primary)", boxShadow: "0 4px 0 var(--duo-primary-edge)" } : {}) }}
          onClick={() => act.mutate({ bookId: book.id, action: book.mine === "want" ? "unwant" : "want" }, { onError: (e) => toast.error(e.message) })}>
          {book.mine && <Check size={16} aria-hidden="true" />}{label}
        </Button>
        {book.mine !== "reading" && <Button variant="ghost" style={{ minHeight: 42, fontSize: 15 }} onClick={onStart} aria-label={`Start reading ${book.title}`}>Start</Button>}
      </div>
    </Card>
  );
}

function Recommend() {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const add = useSend<{ title: string; author: string }, Reading>(["reading"], "/api/reading", "POST", { replace: true });
  return (
    <Card>
      <form style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={(e) => { e.preventDefault(); add.mutate({ title, author }, { onSuccess: () => { setTitle(""); setAuthor(""); toast.success("Added to the team shelf"); }, onError: (err) => toast.error(err.message) }); }}>
        <span style={{ fontFamily: "var(--duo-display)", fontSize: 18, fontWeight: 600 }}>Recommend a book</span>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span className="duo-label">Title</span><input className="duo-input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="The Pragmatic Programmer" /></label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span className="duo-label">Author</span><input className="duo-input" value={author} maxLength={80} onChange={(e) => setAuthor(e.target.value)} placeholder="Hunt and Thomas" /></label>
        <Button type="submit" disabled={add.isPending || !title.trim()} style={{ width: "100%", minHeight: 50 }}><Plus size={18} aria-hidden="true" />Add to the shelf</Button>
      </form>
    </Card>
  );
}

export function ReadingPage() {
  const reading = useReading();
  const router = useRouter();
  const [starting, setStarting] = useState<Reading["shelf"][number] | null>(null);
  const [finished, setFinished] = useState<string | null>(null);
  const head = <PageHeader title="Reading list" subtitle="Track your book, borrow ideas from the team shelf" actions={<BellLink />} back={{ href: "/", label: "Back to home" }} />;
  const data = reading.data;
  if (!data) return <Split head={head}><QueryState error={reading.error} onRetry={() => reading.refetch()} what="the reading list" /></Split>;
  return (
    <>
      <Split head={head} rail={<Recommend />}>
        {data.current ? <ReadingNow current={data.current} onFinished={setFinished} /> : (
          <section aria-label="Reading now" style={{ background: "var(--duo-grape)", color: "var(--duo-grape-text)", borderRadius: 24, padding: "16px 18px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flexShrink: 0 }}><Lappy pose="idle" width={96} decorative /></div>
            <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: "var(--duo-display)", fontSize: 22, fontWeight: 700 }}>Between books</span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>Pick your next one from the team shelf below.</span>
            </span>
          </section>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 className="duo-h2">Team shelf</h2>
          <span className="duo-sub">What the team is reading · {data.finishedThisYear} finished this year. You see counts, never who.</span>
        </div>
        {data.shelf.length === 0 ? <span className="duo-sub">The shelf is empty. Recommend the first book.</span> : (
          <div className="duo-grid2">{data.shelf.map((b) => <ShelfCard key={b.id} book={b} onStart={() => setStarting(b)} />)}</div>
        )}
      </Split>
      {starting && <StartSheet book={starting} onClose={() => setStarting(null)} />}
      {finished && <Celebrate pose="read" title="BOOK FINISHED!" sub={`You finished “${finished}”. One more on the team’s tally.`} onDone={() => setFinished(null)}
        onBrag={() => router.push(`/feed?new=quote&text=${encodeURIComponent(`Just finished “${finished}”. Recommend it!`)}`)} />}
    </>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMarkFeedSeen } from "@/lib/queries";
import { PostCard, type CardItem } from "./post-card";

const SWIPE_PX = 110;

// One card at a time, oldest first: Back/Next buttons and a horizontal swipe. Showing a card
// moves the seen watermark up to it. Taps on the card's own buttons never swipe.
export function CatchUp({ items, index, onIndex, seenAt, onWish }: { items: CardItem[]; index: number; onIndex: (i: number) => void; seenAt: string; onWish: (email: string) => void }) {
  const markSeen = useMarkFeedSeen();
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const item = items[index];
  const last = useRef(seenAt);

  useEffect(() => {
    if (item && item.at > last.current) {
      last.current = item.at;
      markSeen.mutate(item.at);
    }
  }, [item, markSeen]);

  const go = (i: number) => { setDx(0); onIndex(Math.max(0, Math.min(items.length, i))); };
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    start.current = e.clientX;
  };
  const onMove = (e: React.PointerEvent) => { if (start.current !== null) setDx(e.clientX - start.current); };
  const onUp = () => {
    if (start.current === null) return;
    start.current = null;
    if (dx <= -SWIPE_PX) go(index + 1);
    else if (dx >= SWIPE_PX && index > 0) go(index - 1);
    else setDx(0);
  };
  if (!item) return null;

  return (
    <section aria-label="New posts" className="m3-stack" style={{ gap: 12 }}>
      <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 4 }}>
        {items.map((it, i) => <span key={it.id} style={{ height: 4, borderRadius: 2, background: i < index ? "var(--m3-primary)" : i === index ? "#7FB3D5" : "#DFE3E8" }} />)}
      </div>
      <div style={{ position: "relative", minHeight: 340 }}>
        {index + 2 < items.length && <div aria-hidden="true" style={{ position: "absolute", left: 20, right: 20, top: 24, bottom: -12, borderRadius: 28, background: "#E1E6EE" }} />}
        {index + 1 < items.length && <div aria-hidden="true" style={{ position: "absolute", left: 10, right: 10, top: 12, bottom: -6, borderRadius: 28, background: "#E9EDF3" }} />}
        <div aria-live="polite" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ position: "relative", minHeight: 340, display: "flex", touchAction: "pan-y", userSelect: "none", transform: `translateX(${dx}px) rotate(${dx / 40}deg)`, transition: start.current === null ? "transform .25s ease" : "none" }}>
          <PostCard key={item.id} item={item} onWish={onWish} style={{ flex: 1 }} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
        <button type="button" aria-label="Previous post" disabled={index === 0} onClick={() => go(index - 1)} className="m3-btn m3-btn-outlined" style={{ width: 48, height: 48, padding: 0, borderRadius: 24, opacity: index === 0 ? 0.4 : 1 }}><ChevronLeft size={22} aria-hidden="true" /></button>
        <span className="m3-body" aria-live="polite">{index + 1} / {items.length}</span>
        <button type="button" aria-label="Next post" onClick={() => go(index + 1)} className="m3-btn m3-btn-filled" style={{ width: 48, height: 48, padding: 0, borderRadius: 24 }}><ChevronRight size={22} aria-hidden="true" /></button>
      </div>
      <p className="m3-small" style={{ margin: 0, textAlign: "center" }}>Swipe left for the next post, right to go back</p>
    </section>
  );
}

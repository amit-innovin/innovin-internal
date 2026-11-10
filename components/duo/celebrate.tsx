"use client";
import { useEffect } from "react";
import type { LappyPose } from "./lappy-poses";
import { Lappy } from "./lappy";

const COLORS = ["#ffc800", "#ffffff", "#89e219", "#ce82ff", "#ff4b8b", "#235390"];

// The full-screen moment for 8/8 office days, 10K steps and a finished book.
export function Celebrate({ pose, title, sub, onDone, onBrag }: { pose: LappyPose; title: string; sub: string; onDone: () => void; onBrag?: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDone]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: "fixed", inset: 0, zIndex: 70, background: "var(--duo-primary)", color: "var(--duo-on-primary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center", overflow: "hidden" }}>
      <style>{`@keyframes duoFall{from{transform:translateY(-10vh) rotate(0)}to{transform:translateY(110vh) rotate(540deg)}}@media (prefers-reduced-motion: reduce){.duo-confetti{display:none}}`}</style>
      {Array.from({ length: 26 }, (_, i) => (
        <span key={i} className="duo-confetti" aria-hidden="true" style={{ position: "absolute", top: 0, left: `${(i * 37) % 100}%`, width: 10, height: 16, borderRadius: 3, background: COLORS[i % COLORS.length], animation: `duoFall ${2.2 + (i % 5) * 0.4}s linear ${(i % 7) * 0.25}s infinite` }} />
      ))}
      <Lappy pose={pose} width={220} />
      <h1 style={{ margin: 0, fontFamily: "var(--duo-display)", fontSize: 40, fontWeight: 700, letterSpacing: 1 }}>{title}</h1>
      <p style={{ margin: 0, fontSize: 17, maxWidth: 360 }}>{sub}</p>
      {onBrag && <button type="button" className="duo-btn" style={{ background: "#fff", color: "var(--duo-hero)", boxShadow: "0 5px 0 var(--duo-hero-muted)", minWidth: 220 }} onClick={onBrag}>Brag on the feed</button>}
      <button type="button" className="duo-btn duo-btn-text" style={{ color: "var(--duo-on-primary)", textDecoration: "underline" }} onClick={onDone}>Back to it</button>
    </div>
  );
}

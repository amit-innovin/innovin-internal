"use client";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/m3";
import { Sheet } from "@/components/m3/sheet";
import { useAckAnnouncement, useImportantAnnouncement } from "@/lib/queries";

// An important announcement, shown once to each person on whatever page they open next, until
// they tap "Got it" (stored per person, so it doesn't come back on another device). Admins only
// ever see a count of who has seen it (prototype: canvas note importantWhy).
export function ImportantSheet() {
  const important = useImportantAnnouncement();
  const ack = useAckAnnouncement();
  const a = important.data?.announcement;
  if (!a) return null;
  const done = () => ack.mutate(a.id, { onError: (e) => toast.error(e.message) });
  return (
    <Sheet open onClose={done} label="Important announcement">
      <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 24, background: "var(--m3-primary)", color: "var(--m3-on-primary)", display: "grid", placeItems: "center" }}><Megaphone size={22} /></span>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", color: "var(--m3-on-surface-variant)" }}>IMPORTANT{a.authorName ? ` · ${a.authorName.toUpperCase()}, ADMIN` : ""}</span>
      <h2 style={{ margin: 0, fontSize: 24, lineHeight: "30px", fontWeight: 600 }}>{a.title}</h2>
      {a.body && <p className="m3-body" style={{ margin: 0, fontSize: 15, lineHeight: "22px", whiteSpace: "pre-wrap" }}>{a.body}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
        <Button disabled={ack.isPending} onClick={done} style={{ height: 44, padding: "0 24px" }}>Got it</Button>
      </div>
    </Sheet>
  );
}

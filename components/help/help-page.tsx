"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";

// Help (canvas: M3Help): today's answers, one open at a time.
const FAQ: [string, string][] = [
  ["How do I check in?", "Tap Check in on Home when you get to the office. Your phone checks you’re near the office; the app doesn’t keep a map of where you’ve been."],
  ["What are the 8 office days?", "Each month everyone aims for 8 days in the office. Pick your usual days on Days, and tap a date to add or drop a single day. Leave and days the office is closed don’t count against you."],
  ["How do I apply for leave?", "On Days, tap a future date and choose Leave. Your request goes to Zoho People, where your approver decides. The answer shows on Days."],
  ["Is Speak up really anonymous?", "Yes. Admins see the topic and your message. They don’t see your name, email or device, and the date shows only the day. Replies show under My reports, on the device you sent it from."],
  ["Who sees what I post in the Feed?", "Everyone at innovin, with your name. Posts show straight away. If something feels wrong, use Report on the post; for anything anonymous, use Speak up."],
  ["How do tea and snacks work?", "Once you’ve checked in, answer the tea rounds and pick a snack before the order goes in. Admins set the times. Nobody sees who picked what."],
  ["What is Say hi?", "It’s off until you turn it on in Account › Notification settings. Then you can wave at people in the office today, or ask them for chai, lunch or a walk. Up to 3 a day, and only between people who have it on."],
  ["How do events work?", "Admins post events in the Feed. Tap I’m going so they can plan. Events can also arrive as Google Calendar invites."],
  ["What does the Wi-Fi check do?", "It measures download, upload and delay where you are. If it’s slow while you’re checked in, you can report where you’re sitting. Reports don’t carry your name."],
  ["What do notifications show?", "Turn them on in Account › Notification settings. Updates about you only say “Open the app to check your updates”, and Speak up never sends one."],
];

export function HelpPage() {
  const [open, setOpen] = useState(0);
  return (
    <div className="m3 m3-page m3-stack">
      <header style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 8 }}>
        <Link href="/account" className="m3-btn m3-btn-text m3-back" aria-label="Back to account" style={{ width: 48, padding: 0, color: "var(--m3-on-surface)" }}><ArrowLeft size={24} aria-hidden="true" /></Link>
        <h1 className="m3-h1">Help</h1>
      </header>
      <section aria-label="Questions" className="m3-card" style={{ padding: 0, overflow: "hidden" }}>
        {FAQ.map(([q, a], i) => (
          <div key={q} style={{ borderTop: i ? "1px solid var(--m3-outline-variant, #DFE3E8)" : 0 }}>
            <h2 style={{ margin: 0 }}>
              <button type="button" aria-expanded={open === i} aria-controls={`help-${i}`} onClick={() => setOpen(open === i ? -1 : i)}
                style={{ width: "100%", minHeight: 64, border: 0, background: "transparent", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", textAlign: "left", fontFamily: "inherit", fontSize: 16, fontWeight: 600, lineHeight: "22px", color: "var(--m3-on-surface)", cursor: "pointer" }}>
                <span style={{ flex: 1 }}>{q}</span>
                <ChevronDown size={20} aria-hidden="true" style={{ flex: "none", color: "var(--m3-on-surface-variant)", transform: open === i ? "rotate(180deg)" : "none", transition: "transform .2s ease" }} />
              </button>
            </h2>
            {open === i && <p id={`help-${i}`} className="m3-body" style={{ margin: 0, padding: "0 16px 16px", color: "var(--m3-on-surface-variant)" }}>{a}</p>}
          </div>
        ))}
      </section>
      <p className="m3-body" style={{ margin: "0 4px", color: "var(--m3-on-surface-variant)" }}>Something else? Ask an admin, or send it through <Link href="/grievances">Speak up</Link>.</p>
    </div>
  );
}

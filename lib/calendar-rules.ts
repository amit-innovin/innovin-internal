import { createHash } from "node:crypto";
import type { EmployeeRow, EventRow } from "./types";

export type Guest = { email: string; responseStatus?: string; organizer?: boolean; self?: boolean };

// Google accepts client-chosen ids in base32hex (0-9, a-v); hex is a subset. Same event and
// generation, same id: a retry or double submit is a 409 at Google, never a second invite.
export const googleEventId = (eventId: string, generation: number) =>
  createHash("sha256").update(`${eventId}:${generation}`).digest("hex").slice(0, 40);

// Everyone still here, once each, on an allowed domain. The organizer is implicit in Google.
export function guestList(people: EmployeeRow[], organizer: string, domains: string[]): string[] {
  const out = new Set<string>();
  for (const p of people) {
    const email = p.email.trim().toLowerCase();
    if (p.leftOn || email === organizer.toLowerCase() || !domains.includes(email.split("@")[1] ?? "")) continue;
    out.add(email);
  }
  return [...out].sort();
}

// The guest list Google should hold now, keeping each remaining guest's answer.
export function mergeGuests(existing: Guest[], wanted: string[]): Guest[] {
  const byEmail = new Map(existing.filter((g) => !g.organizer).map((g) => [g.email.toLowerCase(), g]));
  return wanted.map((email) => {
    const had = byEmail.get(email);
    return { email, responseStatus: had?.responseStatus ?? "needsAction" };
  });
}

// App events have no end time; the invite blocks an hour.
export function googleEventBody(event: EventRow, id: string, attendees: Guest[]) {
  const end = new Date(Date.parse(event.startsAt) + 3600_000).toISOString();
  return {
    id,
    summary: event.title,
    description: event.body,
    location: event.location,
    start: { dateTime: event.startsAt, timeZone: "Asia/Kolkata" },
    end: { dateTime: end, timeZone: "Asia/Kolkata" },
    attendees,
    guestsCanSeeOtherGuests: false,
    guestsCanInviteOthers: false,
  };
}

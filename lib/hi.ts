// Say hi (prototype: docs/design/m3/, "Say hi to {name}"): opt-in waves and invites between people
// in the office today. Pure wording and validation; the routes enforce who can send to whom.
import type { HiKind, HiRow } from "./types";

export const HI_KINDS: HiKind[] = ["wave", "five", "thanks", "chai", "lunch", "walk"];
export const INVITES: HiKind[] = ["chai", "lunch", "walk"];
export const HI_PER_DAY = 3;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
// An invite's time: now, in 30 minutes, or a quarter hour between 9:00 and 19:00.
export const validHiTime = (t: unknown): t is string =>
  t === "now" || t === "30" || (typeof t === "string" && HHMM.test(t) && t >= "09:00" && t <= "19:00" && Number(t.slice(3)) % 15 === 0);

const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
const when = (t: string | null) => (t === "now" ? "now" : t === "30" ? "in 30 min" : t ? `at ${clock(t)}` : "");
const INVITE_WORD: Record<string, string> = { chai: "chai break", lunch: "lunch together", walk: "walk" };

// What the recipient reads, e.g. "Arjun: chai break now?" or "Arjun waved".
export function hiTitle(h: Pick<HiRow, "kind" | "atTime">, from: string): string {
  if (h.kind === "wave") return `${from} waved`;
  if (h.kind === "five") return `${from}: high five!`;
  if (h.kind === "thanks") return `${from}: thanks!`;
  return `${from}: ${INVITE_WORD[h.kind]} ${when(h.atTime)}?`;
}

// What the sender reads once the other person answers an invite.
export function hiReplyTitle(h: Pick<HiRow, "kind" | "reply">, to: string): string {
  const what = h.kind === "chai" ? "chai" : h.kind === "lunch" ? "lunch" : "a walk";
  return h.reply === "yes" ? `${to} is in for ${what}` : `${to} can't make ${what} today`;
}

// The label on the person's Wave button once you've sent something today.
export function sentLabel(h: Pick<HiRow, "kind" | "atTime">): string {
  const word = { wave: "Waved", five: "High five sent", thanks: "Thanks sent", chai: "Chai", lunch: "Lunch", walk: "Walk" }[h.kind];
  return INVITES.includes(h.kind) ? `${word} ${when(h.atTime)}` : word;
}

export const SNACK_ORDER_KEY = "snackOrder";

// Tea rounds and the daily snack pick (prototype: docs/design/m3/, Snacks). Pure, IST clock times.
import type { TeaRound } from "./types";

export type SnackTimes = { amAt: string; amClose: string; pmAt: string; pmClose: string; orderAt: string };
// Owner ruling: two tea rounds, 11:00 (answers by 10:45) and 4 PM (answers by 3:30); the snack
// order goes in at 12:00. Admins can change all five.
export const DEFAULT_SNACK_TIMES: SnackTimes = { amAt: "11:00", amClose: "10:45", pmAt: "16:00", pmClose: "15:30", orderAt: "12:00" };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Each round's answers close before it, and the morning round is served before the afternoon
// round's answers close, so both rounds can actually be answered.
export const validTimes = (t: Partial<SnackTimes>): t is SnackTimes =>
  [t.amAt, t.amClose, t.pmAt, t.pmClose, t.orderAt].every((v) => typeof v === "string" && HHMM.test(v)) && t.amClose! < t.amAt! && t.pmClose! < t.pmAt! && t.amAt! <= t.pmClose!;

export const istClock = (now: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);

export type Round = { id: TeaRound; at: string; closesAt: string; open: boolean; next: TeaRound | null };

// The round that matters now: the morning one until it's served, then the afternoon one, then none.
export function currentRound(now: Date, t: SnackTimes): Round | null {
  const clock = istClock(now);
  if (clock < t.amAt) return { id: "am", at: t.amAt, closesAt: t.amClose, open: clock < t.amClose, next: "pm" };
  if (clock < t.pmAt) return { id: "pm", at: t.pmAt, closesAt: t.pmClose, open: clock < t.pmClose, next: null };
  return null;
}

export const pickOpen = (now: Date, t: SnackTimes, orderedToday: boolean) => !orderedToday && istClock(now) < t.orderAt;

export function pickCounts(picks: { itemId: string; voterRef?: string }[], itemIds: string[]): Record<string, number> {
  return Object.fromEntries(itemIds.map((id) => [id, picks.filter((p) => p.itemId === id).length]));
}

// Home's tea row: only while a round is still on today, and only for people in the office.
export const teaToShow = (tea: { round: unknown } | null | undefined, inOffice: boolean) => inOffice && !!tea?.round;

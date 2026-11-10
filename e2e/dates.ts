import { nonWorkingReason } from "../lib/leave";
import { todayIST } from "../lib/time";

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// A leave-eligible working day (Mon–Thu, not a holiday or 2nd/4th Saturday) `weeks` weeks ahead
// of today, so a test that books and then cancels never depends on a calendar date going stale.
export function futureWorkday(weeks = 2): string {
  let day = shift(todayIST(), weeks * 7);
  for (;;) {
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (dow >= 1 && dow <= 4 && !nonWorkingReason(day)) return day;
    day = shift(day, 1);
  }
}

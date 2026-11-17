// The admin-set times for tea rounds and the snack order, with the owner's defaults.
import { DEFAULT_SNACK_TIMES, type SnackTimes, validTimes } from "./snacks-rules";
import { store } from "./store";

export async function snackTimes(): Promise<SnackTimes> {
  const saved = await store.getSetting<Partial<SnackTimes>>("snackTea");
  const merged = { ...DEFAULT_SNACK_TIMES, ...(saved ?? {}) };
  return validTimes(merged) ? merged : DEFAULT_SNACK_TIMES;
}

// Tea and today's snack are for people checked in at the office today.
export async function inOfficeToday(email: string, today: string) {
  const row = await store.getAttendance(email, today);
  const { dayMode } = await import("./days");
  return dayMode(row) === "office";
}

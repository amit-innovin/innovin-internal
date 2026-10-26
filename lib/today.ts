import { attendanceLocation } from "@/lib/presence";
// The shapes behind home's three action cards — shared between the API routes and the
// server-rendered home page, so first paint already carries the data instead of the client
// fetching it again after hydration.
import { orderCutoffHour } from "./config";
import { officeLocation, onOfficeNetwork } from "./geo";
import { STEP_GOAL, stepBoard, stepStreak } from "./steps";
import { store } from "./store";
import { ordersForDeviceOn, pantryRef } from "./submitter";
import { istHour, todayIST } from "./time";

export type SessionLite = { email: string; name: string };

export async function attendanceStatus(email: string | null, ip: string | null) {
  const date = todayIST();
  const [rows, day] = await Promise.all([
    store.listAttendance(date),
    email ? store.getAttendance(email, date) : Promise.resolve(null),
  ]);
  return {
    count: new Set(rows.map((r) => r.email)).size,
    email,
    // Lets the client do confident auto check-in: on office Wi-Fi (IP match) or inside the
    // geofence. The office's own coordinates aren't secret to the people who work there.
    onOfficeNetwork: onOfficeNetwork(ip ?? ""),
    office: officeLocation(),
    me: day
      ? {
          checkedIn: !day.checkOutAt,
          checkInAt: day.checkInAt,
          checkOutAt: day.checkOutAt,
          location: attendanceLocation(day),
        }
      : null,
  };
}

export async function snacksMine(deviceId: string | undefined, email?: string) {
  const items = email ? (await store.listOrders(todayIST())).filter((o) => o.submitterRef === pantryRef(email)).map(({ submitterRef: _, ...o }) => o) : await ordersForDeviceOn(deviceId, todayIST());
  return { open: istHour() < orderCutoffHour(), cutoffHour: orderCutoffHour(), items };
}

export async function stepsBoard(session: SessionLite | null) {
  const today = todayIST();
  const [employees, rows] = await Promise.all([store.listEmployees(), store.listSteps()]);
  const board = stepBoard(employees, rows, today);

  let me = null;
  if (session) {
    const mine = rows.filter((r) => r.email === session.email);
    const todayRow = mine.find((r) => r.date === today);
    const entry = board.find((b) => b.email === session.email);
    me = {
      email: session.email,
      name: session.name,
      days: entry?.days ?? 0,
      streak: entry?.streak ?? stepStreak(mine.filter((r) => r.hit).map((r) => r.date), today),
      rank: entry ? board.indexOf(entry) + 1 : null,
      today: todayRow ? { hit: todayRow.hit, steps: todayRow.steps } : null,
      recent: mine.slice(0, 14).map((r) => ({ date: r.date, hit: r.hit, steps: r.steps })),
    };
  }

  return { goal: STEP_GOAL, today, signedIn: !!session, board, me };
}

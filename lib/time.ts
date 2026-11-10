// All office logic runs on IST regardless of where the server lives.
const IST = "Asia/Kolkata";

export function todayIST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date());
}

export function istHour() {
  return parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "numeric", hourCycle: "h23" }).format(
      new Date(),
    ),
    10,
  );
}

// True only for a real calendar day written as YYYY-MM-DD ("2026-02-30" and "10-11-2026" are not).
export function validDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}

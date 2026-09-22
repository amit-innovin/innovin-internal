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

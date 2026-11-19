// Date words for the Days screen. Dates are plain YYYY-MM-DD, read as UTC so they never shift.
const at = (date: string) => new Date(`${date}T00:00:00Z`);
const fmt = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(at(date));

export const longDay = (date: string) => fmt(date, { day: "numeric", month: "long" }); // 18 November
export const fullDay = (date: string) => fmt(date, { weekday: "long", day: "numeric", month: "long" }).replace(/^(\w+) /, "$1, "); // Wednesday, 18 November
export const shortDay = (date: string) => fmt(date, { weekday: "short", day: "numeric", month: "short" }); // Wed 18 Nov
export const weekdayShort = (date: string) => fmt(date, { weekday: "short" }); // Wed
export const monthName = (month: string) => fmt(`${month}-01`, { month: "long" }); // November
export const monthTitle = (month: string) => fmt(`${month}-01`, { month: "long", year: "numeric" }); // November 2026
export const dayNumber = (date: string) => Number(date.slice(8));

export const LEAVE_NAMES = { cl: "Casual", sl: "Sick", el: "Earned", fl: "Flexible" } as const;
export type LeaveKey = keyof typeof LEAVE_NAMES;

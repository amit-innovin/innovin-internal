// Runtime configuration read from environment variables (server-side only).

// Orders are open all day by default (24); set ORDER_CUTOFF_HOUR to enforce a daily deadline.
export function orderCutoffHour() {
  const hour = Number(process.env.ORDER_CUTOFF_HOUR ?? 24);
  return Number.isInteger(hour) && hour >= 0 && hour <= 24 ? hour : 24;
}

// Annual paid-leave allowance per person, in days. Placeholder until real entitlement data lands.
export function leaveAllowanceDays() {
  const days = Number(process.env.LEAVE_ALLOWANCE_DAYS ?? 12);
  return Number.isInteger(days) && days > 0 && days <= 365 ? days : 12;
}

export function allowedEmailDomains() {
  return (process.env.ALLOWED_EMAIL_DOMAINS || "innovinlabs.com")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

// Rate limits (requests per window). The office shares one public IP, so abuse limits are
// keyed per device (cookie) with a looser per-IP ceiling on top.
const MIN = 60_000;
export const LIMITS = {
  adminLoginIp: { max: 5, windowMs: 15 * MIN },
  adminLoginGlobal: { max: 50, windowMs: 15 * MIN },
  grievanceDevice: { max: 10, windowMs: 60 * MIN },
  grievanceIp: { max: 200, windowMs: 60 * MIN },
  wifiDevice: { max: 20, windowMs: 60 * MIN },
  wifiIp: { max: 300, windowMs: 60 * MIN },
  speedtestDevice: { max: 10, windowMs: 10 * MIN },
  speedtestIp: { max: 150, windowMs: 10 * MIN },
  authIp: { max: 30, windowMs: 15 * MIN },
  awayDevice: { max: 15, windowMs: 60 * MIN },
  rsvpDevice: { max: 60, windowMs: 60 * MIN },
  writeIp: { max: 120, windowMs: MIN },
} as const;

export const ADMIN_SESSION_MS = 12 * 60 * 60_000;

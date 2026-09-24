// Runtime configuration read from environment variables (server-side only).

// Orders are open all day by default (24); set ORDER_CUTOFF_HOUR to enforce a daily deadline.
export function orderCutoffHour() {
  const hour = Number(process.env.ORDER_CUTOFF_HOUR ?? 24);
  return Number.isInteger(hour) && hour >= 0 && hour <= 24 ? hour : 24;
}

// Bootstrap owners. These emails are granted the owner role on sign-in, so the first
// admin exists without anyone having to hand out the break-glass PIN.
export function ownerEmails() {
  return (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
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
  // AUTH_IP_LIMIT overrides the sign-in ceiling — a whole office shares one public IP, so
  // onboarding days (and e2e, which signs in dozens of times from one address) need headroom.
  authIp: { max: Number(process.env.AUTH_IP_LIMIT ?? 30) || 30, windowMs: 15 * MIN },
  pingSender: { max: 60, windowMs: 60 * MIN },
  awayDevice: { max: 15, windowMs: 60 * MIN },
  rsvpDevice: { max: 60, windowMs: 60 * MIN },
  writeIp: { max: 120, windowMs: MIN },
} as const;

export const ADMIN_SESSION_MS = 12 * 60 * 60_000;

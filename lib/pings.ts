// Pings are deliberately ephemeral: anything older than a day is purged on access, so there
// is no chat history to browse, export, or leak. What you see is what's still "live".
export const PING_TTL_MS = 24 * 60 * 60_000;
export const PING_MAX_LEN = 140;

// One-tap nudges — the "poke" style items. Free text stays possible, but most pings
// should be a single tap.
export const PING_PRESETS = ["👋 Hi!", "☕ Chai?", "🍽️ Lunch?", "🚶 Walk?", "🎯 Quick call?"] as const;

export const pingExpired = (createdAt: string, now = Date.now()) =>
  now - new Date(createdAt).getTime() > PING_TTL_MS;

const memberPaths = {
  feed: "/feed",
  days: "/days",
  snacks: "/snacks",
  steps: "/steps",
  wifi: "/wifi",
  notifications: "/notifications",
  account: "/account",
  help: "/help",
  "speak-up": "/grievances",
} as const;

export const adminPaths = {
  "admin-today": "/admin",
  "admin-people": "/admin/people",
  "admin-speak-up": "/admin/speak-up",
  "admin-publish": "/admin/publish",
  "admin-office": "/admin/office",
  "admin-wifi": "/admin/wifi",
} as const;

const paths = { ...memberPaths, ...adminPaths, event: "/feed/events" };

export function workspacePath(view: string | null) {
  return view && Object.hasOwn(paths, view) ? paths[view as keyof typeof paths] : "/";
}

// Where Google Calendar connect sends an admin back to.
export const CALENDAR_RETURN_PATH = "/admin/publish?tab=events";

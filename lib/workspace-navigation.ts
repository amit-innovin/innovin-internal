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

export function workspaceHref(href: string) {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, "https://workspace.invalid");
  const event = /^\/feed\/events\/([^/]+)$/.exec(url.pathname);
  const alias = url.pathname === "/admin/today" ? "/admin" : url.pathname === "/admin/snacks" ? "/admin/office" : url.pathname;
  const view = event ? "event" : Object.entries(paths).find(([name, path]) => name !== "event" && path === alias)?.[0];
  if (!view) return href;
  url.searchParams.set("view", view);
  if (event) url.searchParams.set("event", event[1]);
  if (url.pathname === "/admin/snacks") url.searchParams.set("tab", "shelf");
  return `/?${url.searchParams}${url.hash}`;
}

export function calendarReturnPath(workspace: boolean) {
  const path = "/admin/publish?tab=events";
  return workspace ? workspaceHref(path) : path;
}

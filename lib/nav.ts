// Navigation for the Material 3 shell (design: https://claude.ai/artifact/1cR9t8dgrFiqAPsFeV1kPo,
// "Today"). There is no sidebar. Every screen size uses the same five destinations: a floating tab
// bar in the top bar from 768px, and the bottom bar on phones. Account is the avatar in the top
// bar (and on Today), Notifications the bell next to it. Browse lists everything else: 10K steps,
// Wi-Fi, Speak up, Help and, for admins, the admin tools.

export type NavId = "today" | "feed" | "days" | "snacks" | "browse";
export type NavIcon = NavId;

type Item = {
  id: NavId;
  // Short label for the phone bar, full label for the top bar.
  label: { bar: string; top: string };
  href: string;
  // Paths (exact or prefix) that keep this item lit.
  owns: string[];
};

const ITEMS: Item[] = [
  { id: "today", label: { bar: "Today", top: "Today" }, href: "/", owns: ["/", "/notifications"] },
  { id: "feed", label: { bar: "Feed", top: "Feed" }, href: "/feed", owns: ["/feed"] },
  { id: "days", label: { bar: "Days", top: "Days" }, href: "/days", owns: ["/days"] },
  { id: "snacks", label: { bar: "Snacks", top: "Tea & snacks" }, href: "/snacks", owns: ["/snacks"] },
  { id: "browse", label: { bar: "Browse", top: "Browse" }, href: "/browse", owns: ["/browse", "/steps", "/wifi", "/grievances", "/help", "/account", "/admin"] },
];

const matches = (pathname: string, owned: string) => (owned === "/" ? pathname === "/" : pathname === owned || pathname.startsWith(`${owned}/`));

export function navFor(surface: "bar" | "top") {
  return ITEMS.map((i) => ({ id: i.id, label: i.label[surface], icon: i.id as NavIcon, href: i.href }));
}

export function activeNav(pathname: string): NavId | null {
  return ITEMS.find((i) => i.owns.some((o) => matches(pathname, o)))?.id ?? null;
}

// The avatar menu. Sign out is rendered separately because it is an action, not a link.
export const ACCOUNT_MENU = () => [
  { label: "Settings", href: "/account", icon: "settings" as const },
  { label: "Help", href: "/help", icon: "help" as const },
];

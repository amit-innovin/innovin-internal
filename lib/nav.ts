// Navigation for the Material 3 shell (prototype: docs/design/m3/): the phone bottom bar is
// Home · Feed · Days · Snacks · Account; laptop and tablet use a sidebar with Home, Feed, Days,
// Tea & snacks and 10K steps, plus Speak up and an account menu. The Reading list is out of the
// design for now: its page still exists but nothing links to it.
//
// Screens are rebuilt one PR at a time. Until a screen exists, its item points at the legacy
// page that does the same job, and items with nothing behind them yet are left out.

export type NavId = "home" | "feed" | "days" | "snacks" | "steps" | "account";
export type Surface = "bar" | "side";
export type NavIcon = "home" | "feed" | "days" | "snacks" | "steps" | "account";

type Item = {
  id: NavId;
  label: Record<Surface, string>;
  icon: NavIcon;
  // null: nothing to link to yet (built in a later PR).
  href: string | null;
  // Which surface shows the item.
  on: Surface[];
  // Paths (exact or prefix) that keep this item lit, per surface.
  owns: Partial<Record<Surface, string[]>>;
};

const ITEMS: Item[] = [
  { id: "home", label: { bar: "Home", side: "Home" }, icon: "home", href: "/", on: ["bar", "side"], owns: { bar: ["/", "/notifications", "/steps"], side: ["/", "/notifications"] } },
  { id: "feed", label: { bar: "Feed", side: "Feed" }, icon: "feed", href: "/feed", on: ["bar", "side"], owns: { bar: ["/feed"], side: ["/feed"] } },
  { id: "days", label: { bar: "Days", side: "Days" }, icon: "days", href: "/days", on: ["bar", "side"], owns: { bar: ["/days"], side: ["/days"] } },
  { id: "snacks", label: { bar: "Snacks", side: "Tea & snacks" }, icon: "snacks", href: "/snacks", on: ["bar", "side"], owns: { bar: ["/snacks"], side: ["/snacks"] } },
  { id: "steps", label: { bar: "10K steps", side: "10K steps" }, icon: "steps", href: "/steps", on: ["side"], owns: { side: ["/steps"] } },
  { id: "account", label: { bar: "Account", side: "Account" }, icon: "account", href: "/account", on: ["bar"], owns: { bar: ["/account", "/grievances", "/wifi", "/help", "/admin"] } },
];

const matches = (pathname: string, owned: string) => (owned === "/" ? pathname === "/" : pathname === owned || pathname.startsWith(`${owned}/`));

// Routes that already render in the new shell. Everything else still gets the legacy nav.
const DUO_ROUTES = ["/", "/days", "/notifications", "/feed", "/snacks", "/steps", "/reading", "/account", "/grievances", "/wifi", "/admin"];
// The old admin screen keeps the tools the canvas hasn't drawn a new home for yet.
const LEGACY_ROUTES = ["/admin/tools"];
export const isDuoRoute = (pathname: string) => DUO_ROUTES.some((r) => matches(pathname, r)) && !LEGACY_ROUTES.some((r) => matches(pathname, r));

// Laptop sidebar for admins: "Admin" with its sub-pages (D-AdminDesktop and D-AdminDesk-*).
export const ADMIN_NAV = [
  { id: "overview", label: "Overview", href: "/admin" },
  { id: "people", label: "People & office days", href: "/admin/people" },
  { id: "speak", label: "Speak up inbox", href: "/admin/speak-up" },
  { id: "shelf", label: "Snack shelf", href: "/admin/snacks" },
  { id: "wifi", label: "Wi-Fi reports", href: "/admin/wifi" },
] as const;
export const activeAdmin = (pathname: string) =>
  pathname === "/admin" || pathname === "/admin/today" ? "overview" : ADMIN_NAV.find((n) => n.href !== "/admin" && matches(pathname, n.href))?.id ?? null;

export function navFor(surface: Surface) {
  return ITEMS.filter((i) => i.on.includes(surface) && i.href !== null).map((i) => ({ id: i.id, label: i.label[surface], icon: i.icon, href: i.href as string }));
}

export function activeNav(pathname: string, surface: Surface): NavId | null {
  return ITEMS.find((i) => i.on.includes(surface) && (i.owns[surface] ?? []).some((o) => matches(pathname, o)))?.id ?? null;
}

// Laptop and tablet: these live in the menu on the account button, so the pages themselves
// don't repeat them. Sign out is rendered separately because it is an action, not a link.
// Admin is not here: admins get an "Admin" item in the sidebar itself.
// Speak up has its own sidebar item and floating button, and Wi-Fi check sits in the Home header.
export const ACCOUNT_MENU = () => [
  { label: "Settings", href: "/account", icon: "settings" as const },
  { label: "Help", href: "/help", icon: "help" as const },
];

// Speak up is a main feature, so its floating button shows on the main pages. Feed is left out
// because it has its own Post button, and two floating actions would compete.
const SPEAK_FAB_ROUTES = ["/", "/days", "/snacks", "/account"];
export const showsSpeakFab = (pathname: string) => SPEAK_FAB_ROUTES.includes(pathname);

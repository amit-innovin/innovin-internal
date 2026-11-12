// Navigation for the new (Duo) shell, taken from the design canvas: the phone bottom bar is
// Home · Feed · Days · Snacks · Account; laptop and tablet use a sidebar with Home, Feed, Days,
// Tea & snacks, 10K steps and Reading list, plus an account menu.
//
// Screens are rebuilt one PR at a time. Until a screen exists, its item points at the legacy
// page that does the same job, and items with nothing behind them yet are left out.

export type NavId = "home" | "feed" | "days" | "snacks" | "steps" | "reading" | "account";
export type Surface = "bar" | "side";
export type NavIcon = "home" | "feed" | "days" | "snacks" | "steps" | "reading" | "account";

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
  { id: "home", label: { bar: "Home", side: "Home" }, icon: "home", href: "/", on: ["bar", "side"], owns: { bar: ["/", "/notifications", "/steps", "/reading"], side: ["/", "/notifications"] } },
  { id: "feed", label: { bar: "Feed", side: "Feed" }, icon: "feed", href: "/feed", on: ["bar", "side"], owns: { bar: ["/feed"], side: ["/feed"] } },
  { id: "days", label: { bar: "Days", side: "Days" }, icon: "days", href: "/days", on: ["bar", "side"], owns: { bar: ["/days"], side: ["/days"] } },
  { id: "snacks", label: { bar: "Snacks", side: "Tea & snacks" }, icon: "snacks", href: "/snacks", on: ["bar", "side"], owns: { bar: ["/snacks"], side: ["/snacks"] } },
  { id: "steps", label: { bar: "10K steps", side: "10K steps" }, icon: "steps", href: "/steps", on: ["side"], owns: { side: ["/steps"] } },
  { id: "reading", label: { bar: "Reading list", side: "Reading list" }, icon: "reading", href: "/reading", on: ["side"], owns: { side: ["/reading"] } },
  { id: "account", label: { bar: "Account", side: "Account" }, icon: "account", href: "/account", on: ["bar"], owns: { bar: ["/account", "/grievances", "/wifi", "/help", "/admin"] } },
];

const matches = (pathname: string, owned: string) => (owned === "/" ? pathname === "/" : pathname === owned || pathname.startsWith(`${owned}/`));

// Routes that already render in the new shell. Everything else still gets the legacy nav.
const DUO_ROUTES = ["/", "/days", "/notifications", "/feed", "/snacks", "/steps", "/reading", "/account", "/grievances", "/wifi"];
export const isDuoRoute = (pathname: string) => DUO_ROUTES.some((r) => matches(pathname, r));

export function navFor(surface: Surface) {
  return ITEMS.filter((i) => i.on.includes(surface) && i.href !== null).map((i) => ({ id: i.id, label: i.label[surface], icon: i.icon, href: i.href as string }));
}

export function activeNav(pathname: string, surface: Surface): NavId | null {
  return ITEMS.find((i) => i.on.includes(surface) && (i.owns[surface] ?? []).some((o) => matches(pathname, o)))?.id ?? null;
}

// Laptop and tablet: these live in the menu on the account button, so the pages themselves
// don't repeat them. Sign out is rendered separately because it is an action, not a link.
export const ACCOUNT_MENU = (isAdmin: boolean) => [
  { label: "Settings", href: "/account", icon: "settings" as const },
  { label: "Speak up", href: "/grievances", icon: "speak" as const },
  { label: "Wi-Fi check", href: "/wifi", icon: "wifi" as const },
  { label: "Help", href: "/help", icon: "help" as const },
  ...(isAdmin ? [{ label: "Admin", href: "/admin", icon: "admin" as const }] : []),
];

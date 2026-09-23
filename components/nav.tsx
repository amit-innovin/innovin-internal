"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { CalendarCheck, CalendarDays, CircleHelp, Coffee, House, MessageSquare, Settings, ShieldCheck, Users, Wifi } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Logo, Wave } from "@/components/brand";
import Notifications from "@/components/notifications";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; short: string; icon: LucideIcon };

const PRIMARY: Item[] = [
  { href: "/", label: "Home", short: "Home", icon: House },
  { href: "/attendance", label: "Attendance", short: "Attendance", icon: CalendarCheck },
  { href: "/snacks", label: "Meals & Snacks", short: "Meals", icon: Coffee },
  { href: "/grievances", label: "Grievances", short: "Grievances", icon: MessageSquare },
  { href: "/wifi", label: "Wi-Fi Quality", short: "Wi-Fi", icon: Wifi },
];

// Leave and Time Away live inside Attendance now — one surface for "my time".
const SECONDARY: Item[] = [
  { href: "/events", label: "Events", short: "Events", icon: CalendarDays },
  { href: "/people", label: "People", short: "People", icon: Users },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings },
  { href: "/help", label: "Help", short: "Help", icon: CircleHelp },
];

// Shown only to admins and owners — the layout decides from the session, so this stays a
// render-only client component and the link never flashes in for members.
const ADMIN_ITEM: Item = { href: "/admin", label: "Admin", short: "Admin", icon: ShieldCheck };

const SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const reduce = useReducedMotion();
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "text-accent-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          transition={reduce ? { duration: 0 } : SPRING}
          className="absolute inset-0 rounded-lg bg-accent"
        />
      )}
      <item.icon className="relative size-[18px]" />
      <span className="relative">{item.label}</span>
    </Link>
  );
}

export function Sidebar({ showAdmin = false }: { showAdmin?: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-card px-4 py-6 md:flex">
      <div className="mb-8 flex items-center justify-between gap-2 px-2">
        <Link href="/">
          <Logo />
        </Link>
        <Notifications />
      </div>
      <nav className="flex flex-col gap-1">
        {PRIMARY.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>
      <nav className="mt-8 flex flex-col gap-1 border-t pt-6">
        {showAdmin && <NavLink item={ADMIN_ITEM} active={isActive(pathname, ADMIN_ITEM.href)} />}
        {SECONDARY.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>
      <div className="mt-auto px-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Better days
          <br />
          at Innovin
        </p>
        <Wave className="mt-2" />
      </div>
    </aside>
  );
}

export function MobileTopBar({ showAdmin = false }: { showAdmin?: boolean }) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-card/90 px-4 py-3 backdrop-blur md:hidden">
      <Link href="/">
        <Logo />
      </Link>
      <div className="flex items-center gap-1">
        <Notifications />
        {(showAdmin ? [ADMIN_ITEM, ...SECONDARY] : SECONDARY).map((item) => (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <Button asChild variant="ghost" size="icon-lg" className="rounded-full text-muted-foreground">
                <Link href={item.href} aria-label={item.label}>
                  <item.icon className="size-[18px]" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{item.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {PRIMARY.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              active ? "text-accent-foreground" : "text-muted-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="tabbar-active"
                transition={reduce ? { duration: 0 } : SPRING}
                className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent-foreground"
              />
            )}
            <item.icon className="size-5" />
            {item.short}
          </Link>
        );
      })}
    </nav>
  );
}

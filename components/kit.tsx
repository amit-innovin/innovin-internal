// Shared app building blocks, composed from shadcn/ui, beUI and transitions.dev.
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Coffee, Cookie, Leaf, Plus } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatedBadge, type AnimatedBadgeStatus } from "@/components/motion/animated-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GrievanceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// innovinlabs.com palette: brand blue family for identity, green/amber/red only for semantics.
export const TONES = {
  blue: "bg-brand-tint text-brand",
  sky: "bg-[#e8f6fb] text-[#1283ad]",
  ink: "bg-surface-2 text-foreground",
  amber: "bg-amber-50 text-amber-700",
  green: "bg-emerald-50 text-emerald-700",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-surface-2 text-muted-foreground",
} as const;

export type Tone = keyof typeof TONES;

export const MENU_ICONS: Record<string, LucideIcon> = { coffee: Coffee, cookie: Cookie, leaf: Leaf };

const TILE = { sm: "size-9 [&_svg]:size-4", md: "size-11 [&_svg]:size-5", lg: "size-14 [&_svg]:size-6" };

export function IconTile({
  icon: Icon,
  tone,
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone: Tone;
  size?: keyof typeof TILE;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full", TONES[tone], TILE[size], className)}>
      <Icon aria-hidden />
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-lg" className="-ml-2 rounded-full text-muted-foreground">
          <Link href="/" aria-label="Back to home">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="flex-1 text-2xl font-medium">{title}</h1>
        {action}
      </div>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
    </header>
  );
}

export function SectionHeader({
  title,
  badge,
  href,
  linkLabel,
  aside,
}: {
  title: string;
  badge?: string;
  href?: string;
  linkLabel?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex min-h-5 items-center gap-2">
      <h2 className="eyebrow">{title}</h2>
      {badge && <Badge variant="secondary">{badge}</Badge>}
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        {aside}
        {href &&
          (linkLabel ? (
            <Link href={href} className="group inline-flex items-center gap-1 font-medium text-accent-foreground">
              {linkLabel}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <Link href={href} aria-label={`Open ${title}`} className="text-muted-foreground/60 hover:text-foreground">
              <ChevronRight className="size-4" />
            </Link>
          ))}
      </div>
    </div>
  );
}

export function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1 text-xs font-medium text-accent-foreground">
      {children}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export const STATUS_META: Record<GrievanceStatus, { label: string; badge: AnimatedBadgeStatus; tone: Tone }> = {
  open: { label: "Open", badge: "danger", tone: "rose" },
  in_progress: { label: "In progress", badge: "warning", tone: "amber" },
  resolved: { label: "Resolved", badge: "success", tone: "green" },
};

export function StatusPill({ status }: { status: GrievanceStatus }) {
  const meta = STATUS_META[status];
  return (
    <AnimatedBadge status={meta.badge} size="sm" contentKey={status} className="shrink-0">
      {meta.label}
    </AnimatedBadge>
  );
}

export function QualityDot({ quality }: { quality: "good" | "poor" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", quality === "good" ? "text-emerald-600" : "text-rose-600")}>
      <span className={cn("size-2 rounded-full", quality === "good" ? "bg-emerald-500" : "bg-rose-500")} />
      {quality === "good" ? "Good" : "Poor"}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-5 text-center text-sm text-muted-foreground">{children}</p>;
}

// beUI spring-pill tabs, stretched to full width as a segmented control.
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)} variant="pill">
      <TabsList wrapperClassName="w-full" className={cn("grid w-full bg-muted", options.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {options.map((o) => (
          <TabsTrigger key={o.value} value={o.value} className="w-full py-2 font-medium">
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

// transitions.dev "success check" — plays once on mount.
export function SuccessCheck({ className }: { className?: string }) {
  return (
    <span className={cn("t-success-check", className)} data-state="in" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

// transitions.dev "icon swap" — plus ↔ check.
export function PlusCheck({ checked }: { checked: boolean }) {
  return (
    <span className="t-icon-swap" data-state={checked ? "b" : "a"} aria-hidden>
      <Plus className="t-icon size-4" data-icon="a" />
      <Check className="t-icon size-4" data-icon="b" />
    </span>
  );
}

// transitions.dev "texts reveal", generalised — staggered entrance for children.
export const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

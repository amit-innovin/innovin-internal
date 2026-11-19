// Material 3 primitives from the prototype (docs/design/m3/). Styles live in app/m3.css.
// Tappable things are buttons (filled, tonal, outlined, text) or rows with a chevron; cards and chips only inform.
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Variant = "filled" | "tonal" | "outlined" | "text";
export type ChipTone = "success" | "warn" | "neutral";
export type IconTone = "primary" | "secondary" | "tertiary" | "success" | "warn" | "neutral";

export function Button({ variant = "filled", className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={cn("m3-btn", `m3-btn-${variant}`, className)} {...props} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("m3-card", className)} {...props} />;
}

export function StatusChip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <span className={cn("m3-chip", `m3-chip-${tone}`)}>{children}</span>;
}

export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return <span className="m3-avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size / 2.8)) }}>{initials(name)}</span>;
}

// A list row: a link when it goes somewhere, a button when it does something, plain otherwise.
export function ListRow({ href, onClick, leading, title, subtitle, trailing, chevron }: {
  href?: string; onClick?: () => void; leading?: ReactNode; title: ReactNode; subtitle?: ReactNode; trailing?: ReactNode; chevron?: boolean;
}) {
  const body = (
    <>
      {leading}
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ fontWeight: 600 }}>{title}</span>
        {subtitle && <span className="m3-small">{subtitle}</span>}
      </span>
      {trailing}
      {chevron && <ChevronRight size={20} color="var(--m3-on-surface-variant)" aria-hidden="true" />}
    </>
  );
  if (href) return <Link href={href} className="m3-row">{body}</Link>;
  if (onClick) return <button type="button" className="m3-row" onClick={onClick}>{body}</button>;
  return <div className="m3-row">{body}</div>;
}

// Loading and error states that every query-backed screen uses the same way.
export function QueryState({ error, onRetry, what }: { error?: Error | null; onRetry: () => void; what: string }) {
  if (!error) return <div aria-busy="true" aria-label={`Loading ${what}`} className="m3-stack"><div className="m3-card" style={{ height: 120 }} /><div className="m3-card" style={{ height: 180 }} /></div>;
  return (
    <Card role="alert" className="m3-stack" style={{ alignItems: "flex-start" }}>
      <span className="m3-title">Couldn't load {what}</span>
      <span className="m3-small">{error.message}</span>
      <Button onClick={onRetry}>Try again</Button>
    </Card>
  );
}

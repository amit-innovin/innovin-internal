// Duo Pop primitives, ported from the design canvas. Styles live in app/duo.css.
// A solid bottom edge means "tappable"; Card, Flat, Pill and Tile are flat because they only inform.
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "gold" | "green" | "grape" | "sky" | "pink" | "soft";

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "text" }) {
  return <button type={type} className={cn("duo-btn", variant === "primary" ? "duo-btn-p" : variant === "ghost" ? "duo-btn-g" : "duo-btn-text", className)} {...props} />;
}

export function Toggle({ checked, label, onChange, disabled }: { checked: boolean; label: string; onChange: (next: boolean) => void; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="duo-toggle" onClick={() => onChange(!checked)} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("duo-card", className)} {...props} />;
}

export function Flat({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("duo-flat", className)} {...props} />;
}

export function Pill({ tone = "green", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn("duo-pill", `duo-tone-${tone}`)}>{children}</span>;
}

export function Tile({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cn("duo-tile", `duo-tone-${tone}`)} aria-hidden="true">{children}</span>;
}

export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  return <span className="duo-avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size / 2.7)) }}>{initials(name)}</span>;
}

// Every page starts with this: title, one line of context, optional actions on the right.
// `back` is for the phone, where a child screen has no sidebar to get home with.
export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: string; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      {back && (
        <Link href={back.href} aria-label={back.label} className="duo-btn duo-btn-g duo-btn-icon duo-phone-only" style={{ width: 40, minHeight: 40, borderRadius: 20 }}>
          <ChevronLeft size={20} strokeWidth={2.2} aria-hidden="true" />
        </Link>
      )}
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <h1 className="duo-h1">{title}</h1>
        {subtitle && <span className="duo-sub">{subtitle}</span>}
      </div>
      {actions}
    </header>
  );
}

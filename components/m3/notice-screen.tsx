import type { ReactNode } from "react";

// A full-screen card for system pages (404, errors), in the Sign in card's layout.
export function NoticeScreen({ icon, title, children, actions }: { icon: ReactNode; title: string; children?: ReactNode; actions: ReactNode }) {
  return (
    <div className="m3" style={{ minHeight: "100dvh", boxSizing: "border-box", background: "var(--m3-ground)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <main className="m3-stack" style={{ width: "100%", maxWidth: 440, background: "var(--m3-surface)", borderRadius: 28, padding: "28px 24px 24px", boxSizing: "border-box", gap: 16 }}>
        <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 24, background: "var(--m3-secondary-container)", color: "var(--m3-on-secondary-container)", display: "grid", placeItems: "center" }}>{icon}</span>
        <div className="m3-stack" style={{ gap: 6 }}>
          <h1 className="m3-h1">{title}</h1>
          {children && <div className="m3-body" style={{ color: "var(--m3-on-surface-variant)" }}>{children}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>
      </main>
    </div>
  );
}

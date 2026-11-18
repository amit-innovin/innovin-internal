import { HomeScene } from "@/components/m3/art";

// Sign in (canvas: M3SignIn): one card on the surface colour, the morning office scene, and Google.
export function SignInCard({ googleEnabled, next, error }: { googleEnabled: boolean; next: string; error?: string }) {
  return (
    <div className="m3" style={{ minHeight: "100dvh", boxSizing: "border-box", background: "var(--m3-ground)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <main style={{ width: "100%", maxWidth: 440, background: "var(--m3-surface)", borderRadius: 28, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div aria-hidden="true" style={{ position: "relative", height: 180, background: "#D6ECFA", overflow: "hidden" }}><HomeScene time="morning" /></div>
        <div className="m3-stack" style={{ padding: "28px 24px 24px", gap: 16 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--m3-primary)" }}>innovin</span>
          <div className="m3-stack" style={{ gap: 6 }}>
            <h1 className="m3-h1">Sign in</h1>
            <p className="m3-body" style={{ margin: 0, color: "var(--m3-on-surface-variant)" }}>Use your @innovinlabs.com Google account.</p>
          </div>
          {error && <p role="alert" style={{ margin: 0, background: "#FFDAD6", color: "#410002", borderRadius: 12, padding: "12px 14px", fontSize: 14, lineHeight: "20px" }}>{error}</p>}
          {googleEnabled ? (
            <a href={`/api/auth/google?next=${encodeURIComponent(next)}`} className="m3-btn m3-btn-filled" style={{ height: 48, gap: 10 }}><GoogleMark />Continue with Google</a>
          ) : (
            <p role="status" style={{ margin: 0, background: "var(--m3-surface-container)", borderRadius: 12, padding: "12px 14px", fontSize: 14, lineHeight: "20px" }}>Sign-in isn&apos;t set up on this server yet. Ask an admin.</p>
          )}
        </div>
      </main>
    </div>
  );
}

function GoogleMark() {
  return <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12V14h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3ZM12 22c2.7 0 5-.9 6.6-2.5L15.4 17c-.9.6-2 1-3.4 1a6 6 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22ZM6.4 13.9A6 6 0 0 1 6 12c0-.7.1-1.3.4-1.9V7.5H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.5l3.3-2.6ZM12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6A6 6 0 0 1 12 6Z" /></svg>;
}

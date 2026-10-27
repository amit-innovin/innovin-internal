"use client";
import { useEffect, useState, type ReactNode } from "react";
export function LoadRecovery({ children }: { children: ReactNode }) {
  const [failed, setFailed] = useState(false), [expired, setExpired] = useState(false);
  useEffect(() => {
    const fail = (event: Event) => { setFailed(true); if ((event as CustomEvent<{status?: number}>).detail?.status === 401) setExpired(true); };
    window.addEventListener("innovin:load-failure", fail);
    return () => window.removeEventListener("innovin:load-failure", fail);
  }, []);
  if (!failed) return <>{children}</>;
  return <div role="alert" className="rounded-xl border bg-card p-5 text-sm"><p>{expired ? "Your session ended. Sign in to continue." : "We couldn't load this information. Check your connection and try again."}</p><div className="mt-3 flex gap-4"><button className="underline" onClick={() => window.location.reload()}>Try again</button>{expired && <a className="underline" href={`/api/auth/google?next=${encodeURIComponent(typeof window!=="undefined"?window.location.pathname+window.location.search:"/")}`}>Sign in with Google</a>}</div></div>;
}

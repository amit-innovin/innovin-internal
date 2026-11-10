import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Next.js injects inline bootstrap scripts, so script-src needs 'unsafe-inline'; dev tooling
// additionally needs eval and a websocket for HMR.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // The Wi-Fi speed test downloads from fast.com's nearest Netflix CDN node, which has to
  // happen in the browser to measure the office's own connection (api.fast.com itself is
  // called server-side). Downloads only — no credentials are ever sent to these hosts.
  `connect-src 'self' https://*.nflxvideo.net${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // Service worker for Web Push (public/sw.js).
  "worker-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  experimental: {
    // Client router cache: re-navigating to a dynamic page within 30s reuses the streamed
    // payload instead of refetching — makes tab switches feel instant.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Leave and Time Away folded into Attendance. Redirect here rather than keeping stub pages,
  // so there's no extra route to render. Not permanent — browsers cache 308s aggressively and
  // these paths may be reused.
  //
  // Removed features (Phase 2 cut): old links land Home rather than on a 404. Also temporary —
  // /snacks comes back as "Tea & snacks". Redirects run before proxy.ts, so a signed-out
  // visitor goes to "/" and from there to sign-in. Next passes the query string through
  // (/snacks?tab=today → /?tab=today); Home reads no such parameters, so it is harmless.
  async redirects() {
    return [
      { source: "/leave", destination: "/attendance?tab=leave", permanent: false },
      { source: "/away", destination: "/attendance?tab=leave", permanent: false },
      ...["/pantry", "/snacks", "/planner", "/people", "/admin/pantry"].map((source) => ({ source, destination: "/", permanent: false })),
    ];
  },
};

export default nextConfig;

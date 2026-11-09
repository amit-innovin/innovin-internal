import http from "http";

// Stands in for Google's OAuth endpoints during e2e runs (the app reads GOOGLE_AUTH_URL /
// GOOGLE_TOKEN_URL / GOOGLE_TOKENINFO_URL). Each sign-in gets a unique identity: /auth issues a
// timestamped code, /token echoes it back as the id_token, /tokeninfo turns it into an email.
export function startGoogleMock(port = 3999) {
  // Role tests need a *fixed* identity (to match ADMIN_EMAILS, or to grant admin to a known
  // person), so `/as` pins who signs in next until `/as?reset=1` clears it. Runs are serial.
  let pinned: { email: string; name: string } | null = null;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/as") {
      const email = url.searchParams.get("email");
      pinned = url.searchParams.get("reset") || !email ? null : { email, name: url.searchParams.get("name") || email };
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ pinned }));
    }
    if (url.pathname === "/auth") {
      const redirect = new URL(url.searchParams.get("redirect_uri")!);
      redirect.searchParams.set("code", `${Date.now()}${Math.floor(Math.random() * 1e4)}`);
      redirect.searchParams.set("state", url.searchParams.get("state") ?? "");
      res.writeHead(302, { Location: redirect.toString() });
      return res.end();
    }
    if (url.pathname === "/token") {
      let body = "";
      req.on("data", (c) => (body += c));
      return req.on("end", () => {
        const code = new URLSearchParams(body).get("code") ?? "nocode";
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ id_token: code }));
      });
    }
    if (url.pathname === "/tokeninfo") {
      const code = url.searchParams.get("id_token") ?? "unknown";
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          aud: "e2e-client",
          email: pinned?.email ?? `hinan.${code}@innovinlabs.com`,
          email_verified: "true",
          name: pinned?.name ?? "Hinan E2E",
          picture: "",
          hd: "innovinlabs.com",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise<() => Promise<void>>((resolve) =>
    server.listen(port, () => resolve(() => new Promise((done) => server.close(() => done())))),
  );
}

import http from "http";

// Stands in for Google's OAuth endpoints during e2e runs (the app reads GOOGLE_AUTH_URL /
// GOOGLE_TOKEN_URL / GOOGLE_TOKENINFO_URL). Each sign-in gets a unique identity: /auth issues a
// timestamped code, /token echoes it back as the id_token, /tokeninfo turns it into an email.
export function startGoogleMock(port = 3999) {
  // Role tests need a *fixed* identity (to match ADMIN_EMAILS, or to grant admin to a known
  // person), so `/as` pins who signs in next until `/as?reset=1` clears it. Runs are serial.
  let pinned: { email: string; name: string } | null = null;

  // Google Calendar stand-in. A calendar connect (scope has "calendar") issues a code carrying the
  // login_hint, and the token exchange hands back a refresh token naming that admin. `/calendar-as`
  // makes the next connect come back as a different account, `/calendar-noscope` as a grant with
  // the calendar box unticked, and `/calendar-kill` makes an admin's refresh token dead.
  type GEvent = Record<string, unknown> & { id: string; attendees?: { email: string; responseStatus?: string }[] };
  const calendars = new Map<string, Map<string, GEvent>>();
  const log: { op: string; owner: string; id: string; sendUpdates: string | null; summary?: unknown; attendees?: string[] }[] = [];
  const revoked: string[] = [];
  const dead = new Set<string>();
  let calendarAs: string | null = null;
  let noScope = false;
  const json = (res: http.ServerResponse, status: number, body: unknown) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  const readBody = (req: http.IncomingMessage) => new Promise<string>((done) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => done(b)); });
  const ownerOf = (req: http.IncomingMessage) => {
    const token = (req.headers.authorization ?? "").replace(/^Bearer at:/, "");
    return token.startsWith("rt:") ? token.split(":")[1] : null;
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/as") {
      const email = url.searchParams.get("email");
      pinned = url.searchParams.get("reset") || !email ? null : { email, name: url.searchParams.get("name") || email };
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ pinned }));
    }
    if (url.pathname === "/calendar-as") { calendarAs = url.searchParams.get("email"); return json(res, 200, { calendarAs }); }
    if (url.pathname === "/calendar-noscope") { noScope = url.searchParams.get("on") === "1"; return json(res, 200, { noScope }); }
    if (url.pathname === "/calendar-kill") { dead.add(url.searchParams.get("email") ?? ""); return json(res, 200, {}); }
    if (url.pathname === "/calendar-revive") { dead.delete(url.searchParams.get("email") ?? ""); return json(res, 200, {}); }
    if (url.pathname === "/calendar-log") {
      return json(res, 200, { log, revoked, events: Object.fromEntries([...calendars].map(([owner, m]) => [owner, [...m.values()]])) });
    }
    if (url.pathname === "/revoke") {
      return void readBody(req).then((b) => { revoked.push(new URLSearchParams(b).get("token") ?? ""); json(res, 200, {}); });
    }
    const cal = url.pathname.match(/^\/calendar\/v3\/calendars\/primary\/events(?:\/([^/]+))?$/);
    if (cal) {
      const owner = ownerOf(req);
      if (!owner || dead.has(owner)) return json(res, 401, { error: { message: "Invalid Credentials" } });
      const mine = calendars.get(owner) ?? new Map<string, GEvent>();
      calendars.set(owner, mine);
      const sendUpdates = url.searchParams.get("sendUpdates");
      const record = (op: string, e: GEvent) => log.push({ op, owner, id: e.id, sendUpdates, summary: e.summary, attendees: e.attendees?.map((a) => a.email) });
      const id = cal[1];
      if (req.method === "POST" && !id) {
        return void readBody(req).then((b) => {
          const e = JSON.parse(b) as GEvent;
          if (mine.has(e.id)) return json(res, 409, { error: { message: "The requested identifier already exists." } });
          mine.set(e.id, e); record("insert", e); json(res, 200, e);
        });
      }
      const e = id ? mine.get(id) : undefined;
      if (!e) return json(res, 404, { error: { message: "Not Found" } });
      if (req.method === "GET") return json(res, 200, e);
      if (req.method === "DELETE") { mine.delete(e.id); record("delete", e); res.writeHead(204); return res.end(); }
      if (req.method === "PATCH") {
        return void readBody(req).then((b) => { Object.assign(e, JSON.parse(b)); record("patch", e); json(res, 200, e); });
      }
    }
    if (url.pathname === "/auth") {
      const redirect = new URL(url.searchParams.get("redirect_uri")!);
      const calendar = (url.searchParams.get("scope") ?? "").includes("calendar");
      const who = calendar ? (calendarAs ?? url.searchParams.get("login_hint") ?? "") : "";
      calendarAs = null;
      redirect.searchParams.set("code", calendar ? `cal:${who}:${Date.now()}` : `${Date.now()}${Math.floor(Math.random() * 1e4)}`);
      redirect.searchParams.set("state", url.searchParams.get("state") ?? "");
      res.writeHead(302, { Location: redirect.toString() });
      return res.end();
    }
    if (url.pathname === "/token") {
      let body = "";
      req.on("data", (c) => (body += c));
      return req.on("end", () => {
        const form = new URLSearchParams(body);
        if (form.get("grant_type") === "refresh_token") {
          const rt = form.get("refresh_token") ?? "";
          const owner = rt.split(":")[1] ?? "";
          if (!rt.startsWith("rt:") || dead.has(owner) || revoked.includes(rt)) return json(res, 400, { error: "invalid_grant" });
          return json(res, 200, { access_token: `at:${rt}`, expires_in: 3599 });
        }
        const code = form.get("code") ?? "nocode";
        if (code.startsWith("cal:")) {
          if (!form.get("code_verifier")) return json(res, 400, { error: "invalid_grant" });
          const who = code.split(":")[1];
          const scope = noScope ? "openid email" : "openid email https://www.googleapis.com/auth/calendar.events.owned";
          return json(res, 200, { access_token: `at:rt:${who}:x`, refresh_token: `rt:${who}:${Date.now()}`, id_token: `as:${who}`, scope, expires_in: 3599 });
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ id_token: code }));
      });
    }
    if (url.pathname === "/tokeninfo") {
      const code = url.searchParams.get("id_token") ?? "unknown";
      if (code.startsWith("as:")) {
        return json(res, 200, { aud: "e2e-client", email: code.slice(3), email_verified: "true", name: code.slice(3), picture: "", exp: Math.floor(Date.now() / 1000) + 3600 });
      }
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

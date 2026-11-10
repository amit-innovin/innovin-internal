import { mkdirSync, rmSync, writeFileSync } from "fs";
import { Client } from "pg";
import { startGoogleMock } from "./google-mock";
import { LEGACY_WFH } from "./legacy-wfh";

// Fresh data for every run: wipe JSON test files, or truncate the Postgres E2E database.
// Also starts the Google OAuth mock (port 3999) that the test servers are configured against.
export default async function globalSetup() {
  const stopMock = await startGoogleMock();
  rmSync(".test-data", { recursive: true, force: true });
  const url = process.env.E2E_DATABASE_URL;
  // JSON mode only: the one pre-cut pending WFH row that api.spec.ts reads back.
  if (!url) {
    mkdirSync(".test-data", { recursive: true });
    writeFileSync(".test-data/main.json", JSON.stringify({ away: [LEGACY_WFH] }));
  }
  if (url) {
    const client = new Client({ connectionString: url });
    await client.connect();
    // Truncate every app table — a hardcoded list drifts as tables are added, and stale rows
    // leak across runs (the desktop and mobile projects share one database).
    const { rows } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    if (rows.length) await client.query(`TRUNCATE ${rows.map((r) => r.tablename).join(", ")}`);
    await client.end();
  }
  return async () => { await stopMock(); };
}

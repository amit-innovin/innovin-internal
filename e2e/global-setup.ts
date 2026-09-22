import { rmSync } from "fs";
import { Client } from "pg";

// Fresh data for every run: wipe JSON test files, or truncate the Postgres E2E database.
export default async function globalSetup() {
  rmSync(".test-data", { recursive: true, force: true });
  const url = process.env.E2E_DATABASE_URL;
  if (!url) return;
  const client = new Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('attendance','orders','grievances','wifi','announcements')",
  );
  if (rows.length) await client.query(`TRUNCATE ${rows.map((r) => r.tablename).join(", ")}`);
  await client.end();
}

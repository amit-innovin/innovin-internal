import { Client } from "pg";
import { describe, it, expect, vi } from "vitest";
import { storeContract } from "./contract";

// Runs the same contract against a real Postgres when TEST_DATABASE_URL is set
// (CI provides one; locally: TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54329/innovin_test).
const url = process.env.TEST_DATABASE_URL;

if (!url) {
  describe.skip("Postgres store contract (set TEST_DATABASE_URL to run)", () => {
    it("skipped", () => {});
  });
} else {
  process.env.DATABASE_URL = url;

  storeContract(
    "Postgres",
    async () => {
      const { pgStore } = await import("@/lib/pgstore");
      await pgStore.listWifi(1); // ensure the schema exists before truncating
      return pgStore;
    },
    async () => {
      const client = new Client({ connectionString: url });
      await client.connect();
      // Truncate every app table — a hardcoded list drifts whenever a table is added.
      const { rows } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
      if (rows.length) await client.query(`TRUNCATE ${rows.map((r) => r.tablename).join(", ")}`);
      await client.end();
    },
  );
  it("backfills legacy declarations once and respects explicit clears on a cold start", async () => {
    const initial = await import("@/lib/pgstore");
    await initial.pgStore.listWifi(1);
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      // Destructive DDL is confined to TEST_DATABASE_URL, the dedicated contract database.
      await client.query("ALTER TABLE attendance DROP COLUMN IF EXISTS declared_mode");
      await client.query(`INSERT INTO workspace_profiles(email,data) VALUES ($1,$2::jsonb) ON CONFLICT(email) DO UPDATE SET data=EXCLUDED.data`, ["legacy@innovinlabs.com", JSON.stringify({ mode: "office", presenceDate: "2026-10-26" })]);
      await client.query(`INSERT INTO attendance(id,email,date,check_in_at) VALUES ('legacy-migration','legacy@innovinlabs.com','2026-10-26','2026-10-26T04:00:00Z') ON CONFLICT(email,date) DO UPDATE SET check_out_at=NULL`);
      vi.resetModules();
      const { pgStore: upgraded } = await import("@/lib/pgstore");
      const row = await upgraded.getAttendance("legacy@innovinlabs.com", "2026-10-26");
      expect(row).toMatchObject({ declaredMode: "office" });
      await upgraded.checkIn({ ...row!, declaredMode: null });
      vi.resetModules();
      const { pgStore: restarted } = await import("@/lib/pgstore");
      expect(await restarted.getAttendance("legacy@innovinlabs.com", "2026-10-26")).toMatchObject({ declaredMode: null });
    } finally { await client.end(); }
  });

}

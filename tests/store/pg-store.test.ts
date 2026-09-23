import { Client } from "pg";
import { describe, it } from "vitest";
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
      await client.query("TRUNCATE attendance, orders, grievances, wifi, announcements, employees, away");
      await client.end();
    },
  );
}

import { describe, expect, it } from "vitest";
import { SCHEMA } from "@/lib/pgstore";

// The schema runs top to bottom on every start, including against an empty database. Any
// statement that reads from or inserts into a table must come after that table is created.
describe("Postgres schema order", () => {
  it("creates every table before a statement reads from or writes into it", () => {
    const created = new Map<string, number>();
    for (const m of SCHEMA.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) if (!created.has(m[1])) created.set(m[1], m.index!);
    const uses = [...SCHEMA.matchAll(/(?:\bFROM|INSERT INTO)\s+(\w+)/g)];
    for (const use of uses) {
      const at = created.get(use[1]);
      if (at === undefined) continue; // a table created elsewhere (or a function name)
      expect(at, `${use[0]} comes before CREATE TABLE ${use[1]}`).toBeLessThan(use.index!);
    }
  });
});

import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Store contract suites share one Postgres database; run files one at a time.
    fileParallelism: false,
    restoreMocks: true,
  },
});

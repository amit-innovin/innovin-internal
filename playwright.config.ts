import { defineConfig, devices } from "@playwright/test";

// E2E runs against production builds (`next build` first — see `npm run test:e2e`).
//   main   :3210 — orders always open (ORDER_CUTOFF_HOUR=24) so results don't depend on time of day
//   closed :3211 — orders always closed (ORDER_CUTOFF_HOUR=0) to cover the after-cutoff flow
// Storage: E2E_DATABASE_URL → Postgres; otherwise isolated JSON files under .test-data/.
// Browser: CHROME_PATH → use a local Chromium-based browser instead of Playwright's download.
export const MAIN_URL = "http://localhost:3210";
export const CLOSED_URL = "http://localhost:3211";

const db = process.env.E2E_DATABASE_URL;
// Fake office at 12.935,77.624 — e2e geolocation tests check in from inside/outside this geofence.
const serverEnv = (name: string, cutoff: string) => ({
  ADMIN_PASSCODE: "1704",
  PANTRY_INTEGRATION_KEY: "b".repeat(64),
  PANTRY_ORDERING_ENABLED: "true",
  PANTRY_SWIGGY_TEST_URL: "http://localhost:3998",
  PANTRY_SWIGGY_REDIRECT_URI: `http://localhost:${name === "main" ? 3210 : 3211}/api/pantry-provider/callback`,
  ORDER_CUTOFF_HOUR: cutoff,
  ALLOWED_EMAIL_DOMAINS: "innovinlabs.com",
  // Never reach out to fast.com from tests — the speed test falls back to our own payload,
  // and the fast.com path is exercised with a stubbed target instead.
  SPEEDTEST_PROVIDER: "self",
  // Bootstrap owner for the role tests (e2e/roles.spec.ts).
  OWNER_EMAILS: "owner@innovinlabs.com",
  OFFICE_LAT: "12.935",
  OFFICE_LNG: "77.624",
  OFFICE_RADIUS_M: "1000",
  // Google sign-in against the local OAuth mock (e2e/google-mock.ts, started in global-setup).
  GOOGLE_CLIENT_ID: "e2e-client",
  GOOGLE_CLIENT_SECRET: "e2e-secret",
  GOOGLE_AUTH_URL: "http://localhost:3999/auth",
  GOOGLE_TOKEN_URL: "http://localhost:3999/token",
  GOOGLE_TOKENINFO_URL: "http://localhost:3999/tokeninfo",
  SESSION_SECRET: "e2e-session-secret",
  // The suite signs in far more than 30 times per run (desktop + mobile share one server),
  // so the per-IP auth ceiling needs headroom it wouldn't need in production.
  AUTH_IP_LIMIT: "500",
  // DATABASE_URL must be blanked in JSON mode too — the built server loads .env at runtime,
  // which carries the real production DATABASE_URL and would write test data to prod.
  ...(db ? { DATABASE_URL: db } : { DATA_FILE: `.test-data/${name}.json`, DATABASE_URL: "" }),
});

const launchOptions = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: MAIN_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions,
  },
  projects: [
    { name: "desktop", testIgnore: /(?:api|ios)\.spec/, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 }, launchOptions } },
    { name: "mobile", testIgnore: /(?:api|ios)\.spec/, use: { ...devices["Pixel 7"], launchOptions } },
    ...(process.env.E2E_IOS ? [
      { name: "ios-pantry", testMatch: /pantry(?:-safety)?\.spec/, use: { ...devices["iPhone 13"], browserName: "webkit" as const } },
      { name: "ios-small", testMatch: /ios\.spec/, use: { ...devices["iPhone SE (3rd gen)"], browserName: "webkit" as const } },
      { name: "ios", testMatch: /ios\.spec/, use: { ...devices["iPhone 13"], browserName: "webkit" as const } },
      { name: "ios-large", testMatch: /ios\.spec/, use: { ...devices["iPhone 16 Pro Max"], browserName: "webkit" as const } },
    ] : []),
    // API tests run last: they deliberately trip rate limits.
    { name: "api", testMatch: /api\.spec/, dependencies: ["desktop", "mobile"] },
  ],
  webServer: [
    { command: "npm run start -- -p 3210", url: MAIN_URL, env: serverEnv("main", "24"), reuseExistingServer: false, timeout: 60_000 },
    { command: "npm run start -- -p 3211", url: CLOSED_URL, env: serverEnv("closed", "0"), reuseExistingServer: false, timeout: 60_000 },
  ],
});

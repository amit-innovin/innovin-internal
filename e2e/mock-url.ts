// The Google OAuth mock the e2e servers are configured against. The port can be moved with
// E2E_MOCK_PORT so two checkouts (or two sessions) can run the suite at the same time.
export const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 3999);
export const MOCK_URL = `http://localhost:${MOCK_PORT}`;

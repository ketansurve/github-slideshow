import { defineConfig } from "@playwright/test";

/* Two copies of the site are served:
   - "demo" on 4173: exactly what GitHub Pages serves today (no API).
   - "api"  on 4174: the same files in API mode, talking to a seeded test
     API on 8090 (test/e2e/api-server.ts, its own embedded PostgreSQL). */
const DEMO_PORT = 4173;
const API_SITE_PORT = 4174;
const API_PORT = 8090;
const site = (port: number) => `http://localhost:${port}/github-slideshow/bslc-website/`;

export default defineConfig({
  testDir: "test/e2e",
  testMatch: "*.spec.ts",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    // Uses the locally installed Microsoft Edge, so no browser download is needed.
    // Set PW_CHANNEL=chromium (after `npx playwright install chromium`) on CI.
    channel: process.env.PW_CHANNEL || "msedge",
    headless: true,
  },
  projects: [
    { name: "demo", testMatch: "redirect.spec.ts", use: { baseURL: site(DEMO_PORT) } },
    { name: "api", testMatch: "api-mode.spec.ts", use: { baseURL: site(API_SITE_PORT) } },
  ],
  webServer: [
    {
      command: `node scripts/static-server.cjs ${DEMO_PORT}`,
      url: site(DEMO_PORT) + "index.html",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `node scripts/static-server.cjs ${API_SITE_PORT}`,
      url: site(API_SITE_PORT) + "index.html",
      env: { BSLC_API_BASE: `http://localhost:${API_PORT}` },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `node node_modules/tsx/dist/cli.mjs test/e2e/api-server.ts`,
      url: `http://localhost:${API_PORT}/health`,
      env: { E2E_API_PORT: String(API_PORT), E2E_SITE_ORIGIN: `http://localhost:${API_SITE_PORT}` },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});

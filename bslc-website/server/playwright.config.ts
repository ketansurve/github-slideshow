import { defineConfig } from "@playwright/test";

const STATIC_PORT = 4173;

export default defineConfig({
  testDir: "test/e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: `http://localhost:${STATIC_PORT}/github-slideshow/bslc-website/`,
    // Uses the locally installed Microsoft Edge, so no browser download is needed.
    // Set PW_CHANNEL=chromium (after `npx playwright install chromium`) on CI.
    channel: process.env.PW_CHANNEL || "msedge",
    headless: true,
  },
  webServer: [
    {
      command: `node scripts/static-server.cjs ${STATIC_PORT}`,
      url: `http://localhost:${STATIC_PORT}/github-slideshow/bslc-website/index.html`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

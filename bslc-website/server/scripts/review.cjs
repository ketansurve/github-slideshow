/* One command for a LOCAL REVIEW of the live (API) mode: `npm run review`.

   Starts, on this machine only:
   - PostgreSQL (embedded, port 54328) with migrations applied;
   - sample review data (prisma/seed-review.ts);
   - the API on http://localhost:8080 with OTP_DELIVERY=mock-sms, so sign-in
     codes arrive in the simulated SMS inbox at http://localhost:8080/dev/sms;
   - the website in API mode on http://localhost:4174/github-slideshow/bslc-website/

   Ctrl+C stops everything. Never use this for a real deployment. */
"use strict";
const crypto = require("crypto");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { startPg, migrate } = require("./pg.cjs");

const SERVER_DIR = path.resolve(__dirname, "..");
const TSX = path.join(SERVER_DIR, "node_modules", "tsx", "dist", "cli.mjs");
const SITE_PORT = 4174, API_PORT = 8080;

(async () => {
  const { pg, url } = await startPg({ name: "dev-pg", port: 54328, database: "bslc_dev" });
  migrate(url);

  const env = {
    ...process.env,
    NODE_ENV: "development",
    DATABASE_URL: url,
    PORT: String(API_PORT),
    JWT_SECRET: crypto.randomBytes(48).toString("base64url"),   // new each run: restarting signs everyone out
    OTP_DELIVERY: "mock-sms",
    CORS_ORIGINS: `http://localhost:${SITE_PORT}`,
  };

  const seed = spawnSync(process.execPath, [TSX, "prisma/seed-review.ts"], { cwd: SERVER_DIR, env, stdio: "inherit" });
  if (seed.status !== 0) throw new Error("Seeding review data failed");

  const children = [
    spawn(process.execPath, [TSX, "src/index.ts"], { cwd: SERVER_DIR, env, stdio: "inherit" }),
    spawn(process.execPath, ["scripts/static-server.cjs", String(SITE_PORT)], {
      cwd: SERVER_DIR, env: { ...process.env, BSLC_API_BASE: `http://localhost:${API_PORT}` }, stdio: "inherit",
    }),
  ];

  console.log([
    "",
    "Local review is running:",
    `  Website (live mode)  http://localhost:${SITE_PORT}/github-slideshow/bslc-website/`,
    `  SMS inbox (OTPs)     http://localhost:${API_PORT}/dev/sms`,
    `  Accounts + password  ${path.join(SERVER_DIR, ".data", "review-accounts.txt")}`,
    "Press Ctrl+C to stop.",
    "",
  ].join("\n"));

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    children.forEach((c) => { try { c.kill(); } catch (e) { /* already gone */ } });
    try { await pg.stop(); } catch (e) { /* already stopped */ }
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  children.forEach((c) => c.on("exit", (code) => { if (!stopping && code) { console.error("A review process exited; stopping."); stop(); } }));
})().catch((e) => { console.error(e); process.exit(1); });

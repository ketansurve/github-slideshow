/* Local PostgreSQL for development and tests, using the embedded-postgres
   package (real PostgreSQL binaries installed from npm, no admin rights or
   Docker needed). Production must use a managed / NIC-hosted PostgreSQL
   server instead: set DATABASE_URL and never run this there. */
"use strict";
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

const SERVER_DIR = path.resolve(__dirname, "..");

async function startPg({ name, port, database }) {
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const databaseDir = path.join(SERVER_DIR, ".data", name);
  const fresh = !fs.existsSync(path.join(databaseDir, "PG_VERSION"));
  const pg = new EmbeddedPostgres({
    databaseDir,
    port,
    user: "postgres",
    password: "postgres",
    persistent: true,
    // Hindi (Devanagari) content needs UTF-8; on Windows initdb would
    // otherwise pick the system code page (e.g. WIN1252).
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: (m) => { if (process.env.PG_DEBUG) console.error(m); },
  });
  if (fresh) await pg.initialise();
  await pg.start();
  try { await pg.createDatabase(database); } catch (e) { /* already exists */ }
  const url = `postgresql://postgres:postgres@localhost:${port}/${database}`;
  return { pg, url };
}

function migrate(url) {
  const prismaCli = path.join(SERVER_DIR, "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_URL: url },
    stdio: process.env.PG_DEBUG ? "inherit" : "pipe",
  });
}

module.exports = { startPg, migrate };

/* `node scripts/pg.cjs` (npm run db:dev): start the development database,
   apply migrations and keep running until Ctrl+C. */
if (require.main === module) {
  (async () => {
    const { pg, url } = await startPg({ name: "dev-pg", port: 54328, database: "bslc_dev" });
    migrate(url);
    console.log(`PostgreSQL ready. DATABASE_URL=${url}`);
    const stop = async () => { await pg.stop(); process.exit(0); };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  })().catch((e) => { console.error(e); process.exit(1); });
}

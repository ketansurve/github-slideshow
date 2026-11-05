/* Starts a throw-away PostgreSQL (embedded-postgres) for the test run and
   applies the migrations. Set TEST_DATABASE_URL to use an existing server. */
/* eslint-disable @typescript-eslint/no-var-requires */
const { startPg, migrate } = require("../scripts/pg.cjs");

export default async function globalSetup() {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const { pg, url: u } = await startPg({ name: "test-pg", port: 54329, database: "bslc_test" });
    (globalThis as any).__BSLC_PG__ = pg;
    url = u;
  }
  migrate(url);
}

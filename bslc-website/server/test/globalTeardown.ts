export default async function globalTeardown() {
  const pg = (globalThis as any).__BSLC_PG__;
  if (pg) await pg.stop();
}

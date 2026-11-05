import { config } from "./config";
import { createApp } from "./app";
import { prisma } from "./prisma";

const app = createApp();
const server = app.listen(config.PORT, () => {
  console.log(`BSLC API listening on http://localhost:${config.PORT} (${config.NODE_ENV})`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

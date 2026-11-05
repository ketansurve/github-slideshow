/* Creates (or resets) the first administrator account so the Site
   Administration page can be used. Credentials come from the environment
   and are never stored in the repository:

     SEED_ADMIN_USER=records.officer@bihar.gov.in \
     SEED_ADMIN_NAME="Records Officer" \
     SEED_ADMIN_MOBILE=9xxxxxxxxx \
     SEED_ADMIN_PASSWORD='<10+ chars, letter and digit>' \
     npm run seed

   Every other account should then be created from admin.html. */
import { prisma } from "../src/prisma";
import { PASSWORD_RULE, hashPassword } from "../src/auth";

async function main() {
  const userId = process.env.SEED_ADMIN_USER;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!userId || !password) throw new Error("Set SEED_ADMIN_USER and SEED_ADMIN_PASSWORD");
  if (!PASSWORD_RULE.test(password)) throw new Error("SEED_ADMIN_PASSWORD must be 10+ characters with a letter and a digit");
  const data = {
    name: process.env.SEED_ADMIN_NAME || "Administrator",
    mobile: process.env.SEED_ADMIN_MOBILE || null,
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
    failedAttempts: 0,
    lockedUntil: null,
    passwordHash: await hashPassword(password),
  };
  const u = await prisma.user.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  await prisma.auditLog.create({ data: { action: "SEED_ADMIN", entity: "User", entityId: u.id, actorUser: "seed-script" } });
  console.log(`Administrator ready: ${u.userId}`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); }).finally(() => prisma.$disconnect());

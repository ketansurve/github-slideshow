/* Shared test helpers: database reset, user factory, signed-in agents. */
import request from "supertest";
import type { Role, UserStatus } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/prisma";
import { hashPassword } from "../src/auth";

export const app = createApp();
export const PASSWORD = "CorrectHorse42";

/* Clears every table except AuditLog, which is append-only by design (the
   database refuses TRUNCATE on it); tests filter audit rows by entityId. */
export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    "ConsultationComment", "ConsultationParticipant", "Consultation",
    "ContentItem", "DocumentGrant", "Document",
    "Session", "OtpChallenge", "User" CASCADE`);
}

let seq = 0;
export async function makeUser(role: Role, opts: { status?: UserStatus; userId?: string; mobile?: string } = {}) {
  seq += 1;
  return prisma.user.create({
    data: {
      userId: opts.userId || `${role.toLowerCase()}${seq}@test.bslc`,
      name: `${role} User ${seq}`,
      mobile: opts.mobile ?? "9876543210",
      role,
      status: opts.status || "ACTIVE",
      passwordHash: await hashPassword(PASSWORD),
    },
  });
}

/* Full sign-in (password → OTP → token). Returns the bearer token. */
export async function signIn(userId: string, password = PASSWORD): Promise<string> {
  const r1 = await request(app).post("/auth/login").send({ userId, password });
  if (r1.status !== 200) throw new Error(`login failed ${r1.status} ${JSON.stringify(r1.body)}`);
  const r2 = await request(app).post("/auth/otp/verify").send({ challengeId: r1.body.challengeId, otp: r1.body.testOtp });
  if (r2.status !== 200) throw new Error(`otp failed ${r2.status} ${JSON.stringify(r2.body)}`);
  return r2.body.token;
}

export async function tokenFor(role: Role) {
  const u = await makeUser(role);
  return { user: u, token: await signIn(u.userId) };
}

export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

export async function auditRows(entityId: string) {
  return prisma.auditLog.findMany({ where: { entityId }, orderBy: { id: "asc" } });
}

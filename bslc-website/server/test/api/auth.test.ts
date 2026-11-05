import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "../../src/prisma";
import { app, auditRows, bearer, makeUser, PASSWORD, resetDb, signIn } from "../helpers";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("sign-in: password then OTP", () => {
  test("valid password + OTP returns a token that /auth/me accepts", async () => {
    const u = await makeUser("OFFICIAL");
    const r1 = await request(app).post("/auth/login").send({ userId: u.userId, password: PASSWORD });
    expect(r1.status).toBe(200);
    expect(r1.body.sentTo).toBe("XXXXXX3210");
    const r2 = await request(app).post("/auth/otp/verify").send({ challengeId: r1.body.challengeId, otp: r1.body.testOtp });
    expect(r2.status).toBe(200);
    expect(r2.body.user).toEqual({ userId: u.userId, name: u.name, role: "OFFICIAL" });
    const me = await request(app).get("/auth/me").set(bearer(r2.body.token));
    expect(me.status).toBe(200);
    expect(me.body.role).toBe("OFFICIAL");
    const actions = (await auditRows(u.id)).map((r) => r.action);
    expect(actions).toEqual(["OTP_SENT", "LOGIN_SUCCESS"]);
  });

  test("the OTP is stored hashed, never in clear", async () => {
    const u = await makeUser("PUBLIC");
    const r1 = await request(app).post("/auth/login").send({ userId: u.userId, password: PASSWORD });
    const ch = await prisma.otpChallenge.findUniqueOrThrow({ where: { id: r1.body.challengeId } });
    expect(ch.codeHash).not.toContain(r1.body.testOtp);
    expect(ch.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("wrong password and unknown user get the same 401", async () => {
    const u = await makeUser("PUBLIC");
    const a = await request(app).post("/auth/login").send({ userId: u.userId, password: "wrong-password-1" });
    const b = await request(app).post("/auth/login").send({ userId: "nobody@test.bslc", password: "wrong-password-1" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });

  test("an OTP can be used only once", async () => {
    const u = await makeUser("PUBLIC");
    const r1 = await request(app).post("/auth/login").send({ userId: u.userId, password: PASSWORD });
    const ok = await request(app).post("/auth/otp/verify").send({ challengeId: r1.body.challengeId, otp: r1.body.testOtp });
    expect(ok.status).toBe(200);
    const again = await request(app).post("/auth/otp/verify").send({ challengeId: r1.body.challengeId, otp: r1.body.testOtp });
    expect(again.status).toBe(401);
  });

  test("an expired OTP is refused", async () => {
    const u = await makeUser("PUBLIC");
    const r1 = await request(app).post("/auth/login").send({ userId: u.userId, password: PASSWORD });
    await prisma.otpChallenge.update({ where: { id: r1.body.challengeId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const r2 = await request(app).post("/auth/otp/verify").send({ challengeId: r1.body.challengeId, otp: r1.body.testOtp });
    expect(r2.status).toBe(401);
    expect(r2.body.code).toBe("OTP_EXPIRED");
  });
});

describe("lockout after five failed attempts (server-side)", () => {
  test("five bad passwords lock the account; the right password is then refused", async () => {
    const u = await makeUser("OFFICIAL");
    for (let i = 1; i <= 4; i++) {
      const r = await request(app).post("/auth/login").send({ userId: u.userId, password: "bad-password-" + i });
      expect(r.status).toBe(401);
    }
    const fifth = await request(app).post("/auth/login").send({ userId: u.userId, password: "bad-password-5" });
    expect(fifth.status).toBe(423);
    const right = await request(app).post("/auth/login").send({ userId: u.userId, password: PASSWORD });
    expect(right.status).toBe(423);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe("LOCKED");
  });

  test("bad OTPs count towards the lockout", async () => {
    const u = await makeUser("OFFICIAL");
    const r1 = await request(app).post("/auth/login").send({ userId: u.userId, password: PASSWORD });
    const wrong = r1.body.testOtp === "000000" ? "111111" : "000000";
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push((await request(app).post("/auth/otp/verify").send({ challengeId: r1.body.challengeId, otp: wrong })).status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 423]);
    const correct = await request(app).post("/auth/otp/verify").send({ challengeId: r1.body.challengeId, otp: r1.body.testOtp });
    expect(correct.status).toBe(401);
  });

  test("the lock expires after LOCKOUT_MINUTES", async () => {
    const u = await makeUser("PUBLIC", { status: "LOCKED" });
    await prisma.user.update({ where: { id: u.id }, data: { failedAttempts: 5, lockedUntil: new Date(Date.now() - 1000) } });
    const r = await request(app).post("/auth/login").send({ userId: u.userId, password: PASSWORD });
    expect(r.status).toBe(200);
  });

  test("a successful sign-in resets the failure counter", async () => {
    const u = await makeUser("PUBLIC");
    await request(app).post("/auth/login").send({ userId: u.userId, password: "bad-password-1" });
    await signIn(u.userId);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).failedAttempts).toBe(0);
  });
});

describe("account states", () => {
  test("PENDING registrations cannot sign in", async () => {
    const u = await makeUser("PUBLIC", { status: "PENDING" });
    const r = await request(app).post("/auth/login").send({ userId: u.userId, password: PASSWORD });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("PENDING");
  });

  test("DISABLED accounts cannot sign in", async () => {
    const u = await makeUser("OFFICIAL", { status: "DISABLED" });
    const r = await request(app).post("/auth/login").send({ userId: u.userId, password: PASSWORD });
    expect(r.status).toBe(403);
  });

  test("self-registration creates a PENDING PUBLIC account", async () => {
    const r = await request(app).post("/auth/register").send({
      userId: "advocate@test.bslc", name: "A. Advocate", email: "advocate@test.bslc",
      mobile: "9123456780", password: "LongEnough123",
    });
    expect(r.status).toBe(201);
    const u = await prisma.user.findUniqueOrThrow({ where: { userId: "advocate@test.bslc" } });
    expect(u.role).toBe("PUBLIC");
    expect(u.status).toBe("PENDING");
    expect(u.passwordHash).toMatch(/^\$argon2id\$/);
  });

  test("registration cannot choose its own role", async () => {
    const r = await request(app).post("/auth/register").send({
      userId: "sneaky@test.bslc", name: "Sneaky", email: "sneaky@test.bslc",
      mobile: "9123456780", password: "LongEnough123", role: "ADMIN", status: "ACTIVE",
    });
    expect(r.status).toBe(201);
    const u = await prisma.user.findUniqueOrThrow({ where: { userId: "sneaky@test.bslc" } });
    expect(u.role).toBe("PUBLIC");
    expect(u.status).toBe("PENDING");
  });

  test("weak passwords are rejected at registration", async () => {
    const r = await request(app).post("/auth/register").send({
      userId: "weak@test.bslc", name: "Weak", email: "weak@test.bslc", mobile: "9123456780", password: "short",
    });
    expect(r.status).toBe(400);
  });
});

describe("tokens and sessions", () => {
  test("logout revokes the token", async () => {
    const u = await makeUser("OFFICIAL");
    const t = await signIn(u.userId);
    expect((await request(app).post("/auth/logout").set(bearer(t))).status).toBe(204);
    expect((await request(app).get("/auth/me").set(bearer(t))).status).toBe(401);
  });

  test("disabling a user ends their session at once", async () => {
    const u = await makeUser("OFFICIAL");
    const t = await signIn(u.userId);
    await prisma.user.update({ where: { id: u.id }, data: { status: "DISABLED" } });
    expect((await request(app).get("/auth/me").set(bearer(t))).status).toBe(401);
  });

  test("a role change applies immediately, not at token expiry", async () => {
    const admin = await makeUser("ADMIN");
    const t = await signIn(admin.userId);
    expect((await request(app).get("/users").set(bearer(t))).status).toBe(200);
    await prisma.user.update({ where: { id: admin.id }, data: { role: "PUBLIC" } });
    expect((await request(app).get("/users").set(bearer(t))).status).toBe(403);
  });

  test("a forged token (wrong secret) is ignored", async () => {
    const u = await makeUser("ADMIN");
    const t = await signIn(u.userId);
    const { jti } = jwt.decode(t) as { jti: string };
    const forged = jwt.sign({ sub: u.id, jti }, "some-other-secret-some-other-secret-xx", { algorithm: "HS256", issuer: "bslc-api" });
    expect((await request(app).get("/users").set(bearer(forged))).status).toBe(401);
  });

  test("an unsigned (alg none) token is ignored", async () => {
    const u = await makeUser("ADMIN");
    const t = await signIn(u.userId);
    const { jti } = jwt.decode(t) as { jti: string };
    const none = jwt.sign({ sub: u.id, jti, iss: "bslc-api" }, "", { algorithm: "none" as never });
    expect((await request(app).get("/users").set(bearer(none))).status).toBe(401);
  });
});

describe("audit log", () => {
  test("audit rows cannot be updated or deleted, even directly in the database", async () => {
    const u = await makeUser("PUBLIC");
    await signIn(u.userId);
    const row = (await auditRows(u.id))[0];
    await expect(prisma.auditLog.update({ where: { id: row.id }, data: { action: "TAMPERED" } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(`TRUNCATE "AuditLog"`)).rejects.toThrow(/append-only/);
  });

  test("failed sign-ins are recorded", async () => {
    const u = await makeUser("PUBLIC");
    await request(app).post("/auth/login").send({ userId: u.userId, password: "bad-password-1" });
    const rows = await auditRows(u.id);
    expect(rows.map((r) => r.action)).toContain("LOGIN_FAILED");
  });
});

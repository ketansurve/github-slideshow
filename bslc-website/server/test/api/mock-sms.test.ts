/* Simulated SMS for local review (OTP_DELIVERY=mock-sms). */
import request from "supertest";
import { prisma } from "../../src/prisma";
import { config, loadConfig } from "../../src/config";
import { createApp } from "../../src/app";
import { mockOutbox } from "../../src/sms";
import { makeUser, PASSWORD, resetDb } from "../helpers";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const base = { DATABASE_URL: "postgresql://x", JWT_SECRET: "x".repeat(40) };

describe("mock-sms OTP delivery", () => {
  const saved = config.OTP_DELIVERY;
  afterEach(() => { config.OTP_DELIVERY = saved; });

  test("the OTP goes to the simulated inbox, not the API response, and signs in", async () => {
    config.OTP_DELIVERY = "mock-sms";
    const app = createApp();
    const u = await makeUser("OFFICIAL", { mobile: "9800000003" });
    const r1 = await request(app).post("/auth/login").send({ userId: u.userId, password: PASSWORD });
    expect(r1.status).toBe(200);
    expect(r1.body.testOtp).toBeUndefined();
    expect(r1.body.sentTo).toBe("XXXXXX0003");

    const sms = mockOutbox()[0];
    expect(sms.to).toBe("9800000003");
    const code = /^(\d{6}) is your OTP to sign in to the Bihar State Law Commission website\./.exec(sms.text)![1];
    expect(sms.text).toContain("valid for 5 minutes");

    const r2 = await request(app).post("/auth/otp/verify").send({ challengeId: r1.body.challengeId, otp: code });
    expect(r2.status).toBe(200);

    const inbox = await request(app).get("/dev/sms");
    expect(inbox.status).toBe(200);
    expect(inbox.text).toContain(code);
    expect(inbox.headers["content-security-policy"]).toMatch(/default-src 'none'/);
  });

  test("an account without a mobile number gets a clear error", async () => {
    config.OTP_DELIVERY = "mock-sms";
    const app = createApp();
    const u = await prisma.user.create({ data: { userId: "nomobile@test.bslc", name: "No Mobile", role: "OFFICIAL", status: "ACTIVE", passwordHash: (await makeUser("PUBLIC")).passwordHash } });
    const r = await request(app).post("/auth/login").send({ userId: u.userId, password: PASSWORD });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("NO_MOBILE");
  });

  test("the inbox page does not exist in any other mode", async () => {
    config.OTP_DELIVERY = "response";
    expect((await request(createApp()).get("/dev/sms")).status).toBe(404);
  });

  test("production refuses mock-sms", () => {
    expect(() => loadConfig({ ...base, NODE_ENV: "production", OTP_DELIVERY: "mock-sms", CORS_ORIGINS: "https://x.gov.in" } as NodeJS.ProcessEnv))
      .toThrow(/OTP_DELIVERY must be 'sms' in production/);
  });
});

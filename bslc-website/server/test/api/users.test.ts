import request from "supertest";
import { prisma } from "../../src/prisma";
import { app, auditRows, bearer, makeUser, resetDb, tokenFor } from "../helpers";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("user management is ADMIN-only (enforced on the server)", () => {
  test.each(["EDITOR", "OFFICIAL", "PUBLIC"] as const)("%s gets 403 on every /users route", async (role) => {
    const { token } = await tokenFor(role);
    const other = await makeUser("PUBLIC");
    const h = bearer(token);
    expect((await request(app).get("/users").set(h)).status).toBe(403);
    expect((await request(app).post("/users").set(h).send({})).status).toBe(403);
    expect((await request(app).patch(`/users/${other.id}`).set(h).send({ role: "ADMIN" })).status).toBe(403);
    expect((await request(app).post(`/users/${other.id}/password`).set(h).send({})).status).toBe(403);
    expect((await request(app).get("/audit").set(h)).status).toBe(403);
  });

  test("anonymous gets 401", async () => {
    expect((await request(app).get("/users")).status).toBe(401);
    expect((await request(app).get("/audit")).status).toBe(401);
  });
});

describe("ADMIN operations", () => {
  test("create an internal user; password hash never leaves the server", async () => {
    const { token } = await tokenFor("ADMIN");
    const r = await request(app).post("/users").set(bearer(token)).send({
      userId: "so@bihar.gov.in", name: "Section Officer", role: "OFFICIAL", password: "Initial-pass-2026",
    });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe("ACTIVE");
    expect(r.body.passwordHash).toBeUndefined();
    const list = await request(app).get("/users").set(bearer(token));
    expect(list.body.every((u: Record<string, unknown>) => u.passwordHash === undefined)).toBe(true);
    expect((await auditRows(r.body.id)).map((a) => a.action)).toEqual(["USER_CREATE"]);
  });

  test("approve a pending registration", async () => {
    const { token } = await tokenFor("ADMIN");
    const p = await makeUser("PUBLIC", { status: "PENDING" });
    const r = await request(app).patch(`/users/${p.id}`).set(bearer(token)).send({ status: "ACTIVE" });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("ACTIVE");
  });

  test("unlocking resets the failure counter", async () => {
    const { token } = await tokenFor("ADMIN");
    const l = await makeUser("OFFICIAL", { status: "LOCKED" });
    await prisma.user.update({ where: { id: l.id }, data: { failedAttempts: 5 } });
    const r = await request(app).patch(`/users/${l.id}`).set(bearer(token)).send({ status: "ACTIVE" });
    expect(r.body.failedAttempts).toBe(0);
  });

  test("an admin cannot demote or disable themselves", async () => {
    const { user, token } = await tokenFor("ADMIN");
    expect((await request(app).patch(`/users/${user.id}`).set(bearer(token)).send({ role: "PUBLIC" })).status).toBe(409);
    expect((await request(app).patch(`/users/${user.id}`).set(bearer(token)).send({ status: "DISABLED" })).status).toBe(409);
  });

  test("unknown fields (e.g. passwordHash) are rejected on update", async () => {
    const { token } = await tokenFor("ADMIN");
    const o = await makeUser("PUBLIC");
    const r = await request(app).patch(`/users/${o.id}`).set(bearer(token)).send({ passwordHash: "x" });
    expect(r.status).toBe(400);
  });

  test("audit log is readable by ADMIN", async () => {
    const { token } = await tokenFor("ADMIN");
    const r = await request(app).get("/audit?action=LOGIN_SUCCESS").set(bearer(token));
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
  });
});

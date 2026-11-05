import request from "supertest";
import { prisma } from "../../src/prisma";
import { app, auditRows, bearer, resetDb, tokenFor } from "../helpers";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const day = 86_400_000;
async function openConsultation(editorToken: string, over: Record<string, unknown> = {}) {
  const r = await request(app).post("/consultations").set(bearer(editorToken)).send({
    title: "Consultation Paper — Land revenue procedure",
    summary: "Comments invited on simplifying land revenue procedure.",
    opensAt: new Date(Date.now() - day).toISOString(),
    closesAt: new Date(Date.now() + 30 * day).toISOString(),
    status: "OPEN",
    ...over,
  });
  expect(r.status).toBe(201);
  return r.body.id as string;
}

describe("public consultation — participation is by allowlist", () => {
  test("anyone can see an open consultation, but cannot comment", async () => {
    const ed = await tokenFor("EDITOR");
    const id = await openConsultation(ed.token);
    const list = await request(app).get("/consultations");
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ isOpen: true, canComment: false });
    expect((await request(app).post(`/consultations/${id}/comments`).send({ body: "hello" })).status).toBe(401);
  });

  test("a signed-in non-participant gets 403 for reading or posting comments", async () => {
    const ed = await tokenFor("EDITOR");
    const id = await openConsultation(ed.token);
    const off = await tokenFor("OFFICIAL");
    expect((await request(app).get(`/consultations/${id}/comments`).set(bearer(off.token))).status).toBe(403);
    expect((await request(app).post(`/consultations/${id}/comments`).set(bearer(off.token)).send({ body: "My views" })).status).toBe(403);
  });

  test("an editor is not a participant by default either", async () => {
    const ed = await tokenFor("EDITOR");
    const id = await openConsultation(ed.token);
    expect((await request(app).post(`/consultations/${id}/comments`).set(bearer(ed.token)).send({ body: "Editor's views" })).status).toBe(403);
  });

  test("an authorised participant can comment and read the thread", async () => {
    const ed = await tokenFor("EDITOR");
    const id = await openConsultation(ed.token);
    const off = await tokenFor("OFFICIAL");
    expect((await request(app).post(`/consultations/${id}/participants`).set(bearer(ed.token)).send({ userId: off.user.id })).status).toBe(201);

    const me = await request(app).get(`/consultations/${id}`).set(bearer(off.token));
    expect(me.body).toMatchObject({ isParticipant: true, canComment: true });

    const c = await request(app).post(`/consultations/${id}/comments`).set(bearer(off.token)).send({ body: "Section 4 should be simplified." });
    expect(c.status).toBe(201);
    const thread = await request(app).get(`/consultations/${id}/comments`).set(bearer(off.token));
    expect(thread.body.map((m: { body: string }) => m.body)).toEqual(["Section 4 should be simplified."]);
    expect((await auditRows(id)).map((a) => a.action)).toEqual(["CONSULTATION_CREATE", "CONSULTATION_PARTICIPANT_ADD", "CONSULTATION_COMMENT"]);
  });

  test("removing a participant stops further comments", async () => {
    const ed = await tokenFor("EDITOR");
    const id = await openConsultation(ed.token);
    const off = await tokenFor("OFFICIAL");
    await request(app).post(`/consultations/${id}/participants`).set(bearer(ed.token)).send({ userId: off.user.id });
    await request(app).delete(`/consultations/${id}/participants/${off.user.id}`).set(bearer(ed.token));
    expect((await request(app).post(`/consultations/${id}/comments`).set(bearer(off.token)).send({ body: "Still here?" })).status).toBe(403);
  });

  test("comments are refused (409) once the consultation has closed", async () => {
    const ed = await tokenFor("EDITOR");
    const id = await openConsultation(ed.token, {
      opensAt: new Date(Date.now() - 10 * day).toISOString(),
      closesAt: new Date(Date.now() - day).toISOString(),
    });
    const off = await tokenFor("OFFICIAL");
    await request(app).post(`/consultations/${id}/participants`).set(bearer(ed.token)).send({ userId: off.user.id });
    expect((await request(app).post(`/consultations/${id}/comments`).set(bearer(off.token)).send({ body: "Too late" })).status).toBe(409);
  });

  test("draft consultations are hidden from the public", async () => {
    const ed = await tokenFor("EDITOR");
    const id = await openConsultation(ed.token, { status: "DRAFT" });
    expect((await request(app).get("/consultations")).body).toEqual([]);
    expect((await request(app).get(`/consultations/${id}`)).status).toBe(404);
  });

  test("closesAt must be after opensAt", async () => {
    const ed = await tokenFor("EDITOR");
    const r = await request(app).post("/consultations").set(bearer(ed.token)).send({
      title: "Backwards", summary: "Bad dates", opensAt: new Date().toISOString(), closesAt: new Date(Date.now() - day).toISOString(),
    });
    expect(r.status).toBe(400);
  });

  test("only active users can be made participants", async () => {
    const ed = await tokenFor("EDITOR");
    const id = await openConsultation(ed.token);
    const pending = await prisma.user.create({ data: { userId: "p@test.bslc", name: "P", passwordHash: "x", status: "PENDING" } });
    expect((await request(app).post(`/consultations/${id}/participants`).set(bearer(ed.token)).send({ userId: pending.id })).status).toBe(400);
  });
});

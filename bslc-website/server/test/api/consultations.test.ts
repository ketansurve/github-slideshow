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

  test("new consultations default to participants-only, with no public submissions", async () => {
    const ed = await tokenFor("EDITOR");
    const id = await openConsultation(ed.token);
    const c = await request(app).get(`/consultations/${id}`);
    expect(c.body).toMatchObject({ visibility: "PARTICIPANTS", allowPublic: false, canSubmitPublic: false });
  });
});

/* Helpers for the suggestion features below. */
async function withParticipants(over: Record<string, unknown> = {}) {
  const ed = await tokenFor("EDITOR");
  const id = await openConsultation(ed.token, over);
  const a = await tokenFor("OFFICIAL");
  const b = await tokenFor("OFFICIAL");
  for (const u of [a, b]) {
    await request(app).post(`/consultations/${id}/participants`).set(bearer(ed.token)).send({ userId: u.user.id });
  }
  return { ed, id, a, b };
}
const post = (id: string, body: Record<string, unknown>, token?: string) => {
  const r = request(app).post(`/consultations/${id}/comments`);
  return (token ? r.set(bearer(token)) : r).send(body);
};
const thread = async (id: string, token: string) =>
  (await request(app).get(`/consultations/${id}/comments`).set(bearer(token))).body as Array<Record<string, unknown>>;

describe("visibility of suggestions", () => {
  test("PARTICIPANTS: every participant sees all published suggestions", async () => {
    const { id, a, b } = await withParticipants();
    await post(id, { body: "From A" }, a.token);
    await post(id, { body: "From B" }, b.token);
    expect((await thread(id, a.token)).map((m) => m.body)).toEqual(["From A", "From B"]);
  });

  test("PRIVATE: each participant sees only their own; editors see all", async () => {
    const { ed, id, a, b } = await withParticipants({ visibility: "PRIVATE" });
    await post(id, { body: "From A" }, a.token);
    await post(id, { body: "From B" }, b.token);
    expect((await thread(id, a.token)).map((m) => m.body)).toEqual(["From A"]);
    expect((await thread(id, b.token)).map((m) => m.body)).toEqual(["From B"]);
    expect((await thread(id, ed.token)).map((m) => m.body)).toEqual(["From A", "From B"]);
  });

  test("the visibility can be changed later by an editor", async () => {
    const { ed, id, a, b } = await withParticipants();
    await post(id, { body: "From B" }, b.token);
    expect((await request(app).patch(`/consultations/${id}`).set(bearer(ed.token)).send({ visibility: "PRIVATE" })).status).toBe(200);
    expect(await thread(id, a.token)).toEqual([]);
  });
});

describe("private replies from the Commission", () => {
  test("only the author and managers see a reply", async () => {
    const { ed, id, a, b } = await withParticipants();
    const s = await post(id, { body: "Please clarify clause 2" }, a.token);
    const r = await request(app).patch(`/consultations/${id}/comments/${s.body.id}`).set(bearer(ed.token)).send({ reply: "Clause 2 refers to revenue courts." });
    expect(r.status).toBe(200);
    expect(r.body.reply).toBe("Clause 2 refers to revenue courts.");

    const forA = (await thread(id, a.token))[0];
    expect(forA).toMatchObject({ mine: true, reply: "Clause 2 refers to revenue courts." });
    const forB = (await thread(id, b.token))[0];
    expect(forB.body).toBe("Please clarify clause 2");
    expect(forB.reply).toBeUndefined();
    expect((await auditRows(id)).map((x) => x.action)).toContain("CONSULTATION_COMMENT_REPLY");
  });

  test("a reply can be withdrawn by setting it to null", async () => {
    const { ed, id, a } = await withParticipants();
    const s = await post(id, { body: "Question" }, a.token);
    await request(app).patch(`/consultations/${id}/comments/${s.body.id}`).set(bearer(ed.token)).send({ reply: "Answer" });
    const r = await request(app).patch(`/consultations/${id}/comments/${s.body.id}`).set(bearer(ed.token)).send({ reply: null });
    expect(r.body).toMatchObject({ reply: null, repliedAt: null });
  });

  test("participants cannot reply or moderate", async () => {
    const { id, a } = await withParticipants();
    const s = await post(id, { body: "Mine" }, a.token);
    expect((await request(app).patch(`/consultations/${id}/comments/${s.body.id}`).set(bearer(a.token)).send({ reply: "Self reply" })).status).toBe(403);
  });

  test("a comment id from another consultation is not found", async () => {
    const { ed, id, a } = await withParticipants();
    const other = await openConsultation(ed.token, { title: "Another paper" });
    const s = await post(id, { body: "Mine" }, a.token);
    expect((await request(app).patch(`/consultations/${other}/comments/${s.body.id}`).set(bearer(ed.token)).send({ reply: "x y" })).status).toBe(404);
  });
});

describe("suggestions from the public (opt-in per consultation)", () => {
  const anon = { body: "Simplify Form 7.", name: "R. Kumar", email: "R.Kumar@Example.in", consent: true };

  test("refused while allowPublic is off", async () => {
    const { id } = await withParticipants();
    expect((await post(id, anon)).status).toBe(401);
    const visitor = await tokenFor("PUBLIC");
    expect((await post(id, { body: "Hello there" }, visitor.token)).status).toBe(403);
  });

  test("with allowPublic on: anyone may submit; it waits for moderation", async () => {
    const { ed, id, a } = await withParticipants({ allowPublic: true });
    const r = await post(id, anon);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: "PENDING", author: "R. Kumar" });
    expect(r.body.publicEmail).toBeUndefined();

    // Not visible to participants until approved.
    expect(await thread(id, a.token)).toEqual([]);
    const all = await thread(id, ed.token);
    expect(all[0]).toMatchObject({ status: "PENDING", publicEmail: "r.kumar@example.in", viaAccount: false });

    const ok = await request(app).patch(`/consultations/${id}/comments/${r.body.id}`).set(bearer(ed.token)).send({ status: "PUBLISHED" });
    expect(ok.status).toBe(200);
    const seen = await thread(id, a.token);
    expect(seen.map((m) => m.body)).toEqual(["Simplify Form 7."]);
    expect(seen[0].publicEmail).toBeUndefined();          // e-mail never shown to participants
  });

  test("rejected suggestions stay hidden but are kept for managers", async () => {
    const { ed, id, a } = await withParticipants({ allowPublic: true });
    const r = await post(id, anon);
    await request(app).patch(`/consultations/${id}/comments/${r.body.id}`).set(bearer(ed.token)).send({ status: "REJECTED" });
    expect(await thread(id, a.token)).toEqual([]);
    expect((await thread(id, ed.token))[0].status).toBe("REJECTED");
  });

  test("a signed-in non-participant may submit and later sees their own, with the reply", async () => {
    const { ed, id } = await withParticipants({ allowPublic: true });
    const visitor = await tokenFor("PUBLIC");
    const s = await post(id, { body: "My suggestion" }, visitor.token);
    expect(s.body.status).toBe("PENDING");
    await request(app).patch(`/consultations/${id}/comments/${s.body.id}`).set(bearer(ed.token)).send({ reply: "Thank you, noted." });
    const mine = await thread(id, visitor.token);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ mine: true, status: "PENDING", reply: "Thank you, noted." });
  });

  test("a submission without an account needs a name, a valid e-mail and consent", async () => {
    const { id } = await withParticipants({ allowPublic: true });
    expect((await post(id, { ...anon, name: undefined })).status).toBe(400);
    expect((await post(id, { ...anon, email: "not-an-email" })).status).toBe(400);
    expect((await post(id, { ...anon, consent: false })).status).toBe(400);
    expect((await post(id, { ...anon, status: "PUBLISHED" })).status).toBe(400);   // cannot self-publish
  });

  test("public submissions are refused once the consultation closes", async () => {
    const ed = await tokenFor("EDITOR");
    const id = await openConsultation(ed.token, {
      allowPublic: true,
      opensAt: new Date(Date.now() - 10 * day).toISOString(),
      closesAt: new Date(Date.now() - day).toISOString(),
    });
    expect((await post(id, anon)).status).toBe(409);
  });
});

describe("CSV export", () => {
  test("managers get every suggestion, including pending and e-mails; formulas are neutralised", async () => {
    const { ed, id, a } = await withParticipants({ allowPublic: true });
    await post(id, { body: "=HYPERLINK(\"http://evil\",\"x\")" }, a.token);
    await post(id, { body: "Line one, with \"quotes\"\nline two", name: "बिहार नागरिक", email: "c@example.in", consent: true });
    const r = await request(app).get(`/consultations/${id}/export.csv`).set(bearer(ed.token)).buffer(true).parse((res, cb) => {
      let d = ""; res.setEncoding("utf8"); res.on("data", (c: string) => { d += c; }); res.on("end", () => cb(null, d));
    });
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/^text\/csv/);
    expect(r.headers["content-disposition"]).toMatch(/^attachment; filename="suggestions-/);
    const text = r.body as string;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(text).toContain(`"Line one, with ""quotes""\nline two"`);
    expect(text).toContain("बिहार नागरिक");
    expect(text).toContain("c@example.in");
    expect(text).toContain("PENDING");
    expect((await auditRows(id)).map((x) => x.action)).toContain("CONSULTATION_EXPORT");
  });

  test("participants cannot export", async () => {
    const { id, a } = await withParticipants();
    expect((await request(app).get(`/consultations/${id}/export.csv`).set(bearer(a.token))).status).toBe(403);
  });
});

import request from "supertest";
import { prisma } from "../../src/prisma";
import { app, auditRows, bearer, resetDb, tokenFor } from "../helpers";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const circular = (over: Record<string, unknown> = {}) => ({
  kind: "CIRCULAR", titleEn: "Circular No. 12 — Office timings", titleHi: "परिपत्र संख्या 12",
  refNo: "Circular No. 12", issuedOn: "2026-10-01", status: "PUBLISHED", ...over,
});

describe("content management", () => {
  test("an editor publishes a circular; the public sees it", async () => {
    const { token } = await tokenFor("EDITOR");
    const r = await request(app).post("/content").set(bearer(token)).send(circular());
    expect(r.status).toBe(201);
    expect(r.body.publishedAt).not.toBeNull();
    const pub = await request(app).get("/content?kind=CIRCULAR");
    expect(pub.body.map((i: { titleEn: string }) => i.titleEn)).toEqual(["Circular No. 12 — Office timings"]);
    expect(pub.body[0].createdById).toBeUndefined();
    expect((await auditRows(r.body.id)).map((a) => a.action)).toEqual(["CONTENT_CREATE"]);
  });

  test("drafts and archived items are not public", async () => {
    const { token } = await tokenFor("EDITOR");
    await request(app).post("/content").set(bearer(token)).send(circular({ status: "DRAFT", titleEn: "Draft circular" }));
    const a = await request(app).post("/content").set(bearer(token)).send(circular({ titleEn: "Old circular" }));
    await request(app).patch(`/content/${a.body.id}`).set(bearer(token)).send({ status: "ARCHIVED" });
    expect((await request(app).get("/content")).body).toEqual([]);
    const manage = await request(app).get("/content/manage").set(bearer(token));
    expect(manage.body).toHaveLength(2);
  });

  test("restricted items need a signed-in user", async () => {
    const ed = await tokenFor("EDITOR");
    await request(app).post("/content").set(bearer(ed.token)).send(circular({ kind: "NOTICE", titleEn: "Internal notice", accessLevel: "RES" }));
    expect((await request(app).get("/content")).body).toHaveLength(0);
    const off = await tokenFor("OFFICIAL");
    expect((await request(app).get("/content").set(bearer(off.token))).body).toHaveLength(1);
  });

  test("links must be http(s): javascript: URLs are refused", async () => {
    const { token } = await tokenFor("EDITOR");
    const bad = await request(app).post("/content").set(bearer(token)).send({ kind: "LINK", titleEn: "Evil link", url: "javascript:alert(1)" });
    expect(bad.status).toBe(400);
    const ok = await request(app).post("/content").set(bearer(token)).send({ kind: "LINK", titleEn: "India Code", url: "https://www.indiacode.nic.in/", status: "PUBLISHED" });
    expect(ok.status).toBe(201);
  });

  test("a non-existent linked document is refused", async () => {
    const { token } = await tokenFor("EDITOR");
    const r = await request(app).post("/content").set(bearer(token)).send(circular({ documentId: "00000000-0000-4000-8000-000000000000" }));
    expect(r.status).toBe(400);
  });

  test("unknown fields (e.g. createdById) are rejected", async () => {
    const { token } = await tokenFor("EDITOR");
    expect((await request(app).post("/content").set(bearer(token)).send(circular({ createdById: "x" }))).status).toBe(400);
  });
});

import net from "net";
import request from "supertest";
import { prisma } from "../../src/prisma";
import { config } from "../../src/config";
import { scanFile } from "../../src/scan";
import { app, auditRows, bearer, resetDb, tokenFor } from "../helpers";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(256, 0x90)]);

type Up = { buf: Buffer; name: string; type: string; fields?: Record<string, string> };
function upload(token: string, u: Up) {
  const r = request(app).post("/documents").set(bearer(token));
  const fields = { title: "Report No. 42 — Test", docType: "Report", issuedOn: "2026-08-12", accessLevel: "PUB", ...(u.fields || {}) };
  for (const [k, v] of Object.entries(fields)) r.field(k, v);
  return r.attach("file", u.buf, { filename: u.name, contentType: u.type });
}

/* Uploads and releases (no scanner in tests), returning the document id. */
async function uploadReleased(editorToken: string, adminToken: string, accessLevel: string, title = "Doc " + accessLevel) {
  const r = await upload(editorToken, { buf: PDF, name: "doc.pdf", type: "application/pdf", fields: { accessLevel, title } });
  expect(r.status).toBe(201);
  const rel = await request(app).post(`/documents/${r.body.id}/release`).set(bearer(adminToken)).send({ note: "Checked manually by records officer" });
  expect(rel.status).toBe(200);
  return r.body.id as string;
}

describe("upload validation", () => {
  test("a valid PDF is accepted, hashed and recorded in the audit log", async () => {
    const { token } = await tokenFor("EDITOR");
    const r = await upload(token, { buf: PDF, name: "report-42.pdf", type: "application/pdf" });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ title: "Report No. 42 — Test", year: 2026, accessLevel: "PUB", mime: "application/pdf", scanStatus: "PENDING" });
    expect(r.body.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect((await auditRows(r.body.id)).map((a) => a.action)).toEqual(["DOCUMENT_UPLOAD"]);
  });

  test("a valid PNG is accepted", async () => {
    const { token } = await tokenFor("EDITOR");
    expect((await upload(token, { buf: PNG, name: "chart.png", type: "image/png" })).status).toBe(201);
  });

  test("UTF-8 text (Hindi) is accepted", async () => {
    const { token } = await tokenFor("EDITOR");
    expect((await upload(token, { buf: Buffer.from("बिहार राज्य विधि आयोग\n"), name: "note.txt", type: "text/plain" })).status).toBe(201);
  });

  test("an executable renamed to .pdf is rejected (magic bytes)", async () => {
    const { token } = await tokenFor("EDITOR");
    const r = await upload(token, { buf: EXE, name: "report.pdf", type: "application/pdf" });
    expect(r.status).toBe(415);
    expect(await prisma.document.count()).toBe(0);
  });

  test("a PNG named .pdf is rejected", async () => {
    const { token } = await tokenFor("EDITOR");
    expect((await upload(token, { buf: PNG, name: "scan.pdf", type: "application/pdf" })).status).toBe(415);
  });

  test("a declared MIME type that does not match the extension is rejected", async () => {
    const { token } = await tokenFor("EDITOR");
    expect((await upload(token, { buf: PDF, name: "report.pdf", type: "image/png" })).status).toBe(415);
  });

  test.each([
    ["setup.exe", "application/x-msdownload"],
    ["minutes.docm", "application/vnd.ms-word.document.macroEnabled.12"],
    ["page.html", "text/html"],
    ["image.svg", "image/svg+xml"],
    ["noextension", "application/pdf"],
  ])("disallowed type %s is rejected", async (name, type) => {
    const { token } = await tokenFor("EDITOR");
    expect((await upload(token, { buf: PDF, name, type })).status).toBe(415);
  });

  test("PDFs with JavaScript are rejected, including #xx-obfuscated names", async () => {
    const { token } = await tokenFor("EDITOR");
    const js = Buffer.concat([PDF, Buffer.from("<< /S /JavaScript /JS (app.alert(1)) >>")]);
    const obf = Buffer.concat([PDF, Buffer.from("<< /S /J#61vaScript >>")]);
    const launch = Buffer.concat([PDF, Buffer.from("<< /S /Launch /F (cmd.exe) >>")]);
    expect((await upload(token, { buf: js, name: "a.pdf", type: "application/pdf" })).status).toBe(415);
    expect((await upload(token, { buf: obf, name: "b.pdf", type: "application/pdf" })).status).toBe(415);
    expect((await upload(token, { buf: launch, name: "c.pdf", type: "application/pdf" })).status).toBe(415);
  });

  test("binary data in a .txt is rejected", async () => {
    const { token } = await tokenFor("EDITOR");
    expect((await upload(token, { buf: Buffer.from([0x41, 0x00, 0x42]), name: "x.txt", type: "text/plain" })).status).toBe(415);
  });

  test("files over MAX_UPLOAD_MB are rejected with 413", async () => {
    const { token } = await tokenFor("EDITOR");
    const big = Buffer.concat([PDF, Buffer.alloc(config.MAX_UPLOAD_MB * 1024 * 1024 + 10, 0x20)]);
    const r = await upload(token, { buf: big, name: "big.pdf", type: "application/pdf" });
    expect(r.status).toBe(413);
  });

  test("path components in the filename are stripped", async () => {
    const { token } = await tokenFor("EDITOR");
    const r = await upload(token, { buf: PDF, name: "../../etc/passwd.pdf", type: "application/pdf" });
    expect(r.status).toBe(201);
    expect(r.body.originalName).toBe("passwd.pdf");
  });

  test("missing metadata is rejected", async () => {
    const { token } = await tokenFor("EDITOR");
    const r = await upload(token, { buf: PDF, name: "a.pdf", type: "application/pdf", fields: { title: "" } });
    expect(r.status).toBe(400);
  });

  test.each(["OFFICIAL", "PUBLIC"] as const)("%s cannot upload", async (role) => {
    const { token } = await tokenFor(role);
    expect((await upload(token, { buf: PDF, name: "a.pdf", type: "application/pdf" })).status).toBe(403);
  });

  test("anonymous cannot upload", async () => {
    const r = await request(app).post("/documents").attach("file", PDF, { filename: "a.pdf", contentType: "application/pdf" });
    expect(r.status).toBe(401);
  });
});

describe("malware scanning (ClamAV INSTREAM)", () => {
  function fakeClamd(reply: string) {
    return new Promise<net.Server>((resolve) => {
      const srv = net.createServer((sock) => {
        let n = 0;
        sock.on("data", (d) => { n += d.length; if (d.subarray(-4).equals(Buffer.alloc(4)) && n > 14) sock.end(reply + "\0"); });
      });
      srv.listen(0, "127.0.0.1", () => resolve(srv));
    });
  }
  const port = (s: net.Server) => (s.address() as net.AddressInfo).port;

  test("an infected upload is refused with 422 and nothing is stored", async () => {
    const srv = await fakeClamd("stream: Eicar-Test-Signature FOUND");
    config.CLAMAV_HOST = "127.0.0.1"; config.CLAMAV_PORT = port(srv);
    try {
      const { token } = await tokenFor("EDITOR");
      const r = await upload(token, { buf: PDF, name: "eicar.pdf", type: "application/pdf" });
      expect(r.status).toBe(422);
      expect(await prisma.document.count()).toBe(0);
      const a = await prisma.auditLog.findFirst({ where: { action: "UPLOAD_REJECTED_MALWARE" }, orderBy: { id: "desc" } });
      expect((a!.detail as Record<string, unknown>).signature).toBe("Eicar-Test-Signature");
    } finally { delete config.CLAMAV_HOST; srv.close(); }
  });

  test("a clean scan marks the document CLEAN", async () => {
    const srv = await fakeClamd("stream: OK");
    config.CLAMAV_HOST = "127.0.0.1"; config.CLAMAV_PORT = port(srv);
    try {
      const { token } = await tokenFor("EDITOR");
      const r = await upload(token, { buf: PDF, name: "ok.pdf", type: "application/pdf" });
      expect(r.status).toBe(201);
      expect(r.body.scanStatus).toBe("CLEAN");
    } finally { delete config.CLAMAV_HOST; srv.close(); }
  });

  test("an unreachable scanner fails closed (503)", async () => {
    config.CLAMAV_HOST = "127.0.0.1"; config.CLAMAV_PORT = 1;
    try {
      const { token } = await tokenFor("EDITOR");
      expect((await upload(token, { buf: PDF, name: "x.pdf", type: "application/pdf" })).status).toBe(503);
    } finally { delete config.CLAMAV_HOST; }
  });

  test("scanFile reports NOT_CONFIGURED without a host", async () => {
    expect(await scanFile(__filename, undefined)).toEqual({ status: "NOT_CONFIGURED" });
  });
});

describe("document access (role-based, server-side)", () => {
  test("unscanned files can be opened by ADMIN only", async () => {
    const ed = await tokenFor("EDITOR");
    const ad = await tokenFor("ADMIN");
    const off = await tokenFor("OFFICIAL");
    const r = await upload(ed.token, { buf: PDF, name: "a.pdf", type: "application/pdf", fields: { accessLevel: "RES" } });
    expect((await request(app).get(`/documents/${r.body.id}/file`).set(bearer(off.token))).status).toBe(403);
    expect((await request(app).get(`/documents/${r.body.id}/file`).set(bearer(ad.token))).status).toBe(200);
    expect((await request(app).post(`/documents/${r.body.id}/release`).set(bearer(ed.token)).send({ note: "editor tries" })).status).toBe(403);
  });

  test("access levels filter the listing for every role", async () => {
    const ed = await tokenFor("EDITOR");
    const ad = await tokenFor("ADMIN");
    const pub = await uploadReleased(ed.token, ad.token, "PUB");
    const res = await uploadReleased(ed.token, ad.token, "RES");
    const conf = await uploadReleased(ed.token, ad.token, "CONF");
    const off = await tokenFor("OFFICIAL");
    const visitor = await tokenFor("PUBLIC");

    const ids = async (h: Record<string, string>) => (await request(app).get("/documents").set(h)).body.map((d: { id: string }) => d.id).sort();
    expect(await ids({})).toEqual([pub]);
    expect(await ids(bearer(visitor.token))).toEqual([pub, res].sort());
    expect(await ids(bearer(off.token))).toEqual([pub, res].sort());
    expect(await ids(bearer(ed.token))).toEqual([pub, res, conf].sort());   // uploader
    expect(await ids(bearer(ad.token))).toEqual([pub, res, conf].sort());
  });

  test("signed-out visitors get 401 for restricted files (so the site can send them to login)", async () => {
    const ed = await tokenFor("EDITOR");
    const ad = await tokenFor("ADMIN");
    const res = await uploadReleased(ed.token, ad.token, "RES");
    const pub = await uploadReleased(ed.token, ad.token, "PUB");
    expect((await request(app).get(`/documents/${res}/file`)).status).toBe(401);
    expect((await request(app).get(`/documents/${pub}/file`)).status).toBe(200);
  });

  test("CONF: hidden from ungranted users, view-only for named users", async () => {
    const ed = await tokenFor("EDITOR");
    const ad = await tokenFor("ADMIN");
    const conf = await uploadReleased(ed.token, ad.token, "CONF");
    const off = await tokenFor("OFFICIAL");

    expect((await request(app).get(`/documents/${conf}`).set(bearer(off.token))).status).toBe(404);
    expect((await request(app).get(`/documents/${conf}/file`).set(bearer(off.token))).status).toBe(404);

    expect((await request(app).put(`/documents/${conf}/grants`).set(bearer(ed.token)).send({ userIds: [off.user.id] })).status).toBe(200);
    const meta = await request(app).get(`/documents/${conf}`).set(bearer(off.token));
    expect(meta.status).toBe(200);
    expect(meta.body).toMatchObject({ canOpen: true, canDownload: false });

    const view = await request(app).get(`/documents/${conf}/file`).set(bearer(off.token));
    expect(view.status).toBe(200);
    expect(view.headers["content-disposition"]).toMatch(/^inline;/);
    expect((await request(app).get(`/documents/${conf}/file?download=1`).set(bearer(off.token))).status).toBe(403);
    expect((await request(app).get(`/documents/${conf}/file?download=1`).set(bearer(ad.token))).status).toBe(403);
  });

  test("served files carry nosniff, a sandbox CSP and no-store", async () => {
    const ed = await tokenFor("EDITOR");
    const ad = await tokenFor("ADMIN");
    const id = await uploadReleased(ed.token, ad.token, "PUB");
    const r = await request(app).get(`/documents/${id}/file?download=1`);
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toBe("application/pdf");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["content-security-policy"]).toMatch(/^sandbox/);
    expect(r.headers["cache-control"]).toBe("private, no-store");
    expect(r.headers["content-disposition"]).toMatch(/^attachment;/);
    expect(Buffer.from(r.body).equals(PDF)).toBe(true);
  });

  test("every view and download is logged", async () => {
    const ed = await tokenFor("EDITOR");
    const ad = await tokenFor("ADMIN");
    const id = await uploadReleased(ed.token, ad.token, "RES");
    const off = await tokenFor("OFFICIAL");
    await request(app).get(`/documents/${id}/file`).set(bearer(off.token));
    await request(app).get(`/documents/${id}/file?download=1`).set(bearer(off.token));
    const rows = (await auditRows(id)).filter((a) => a.actorId === off.user.id).map((a) => a.action);
    expect(rows).toEqual(["DOCUMENT_VIEW", "DOCUMENT_DOWNLOAD"]);
  });

  test("withdrawn documents disappear for non-managers", async () => {
    const ed = await tokenFor("EDITOR");
    const ad = await tokenFor("ADMIN");
    const id = await uploadReleased(ed.token, ad.token, "PUB");
    expect((await request(app).patch(`/documents/${id}`).set(bearer(ed.token)).send({ withdrawn: true })).status).toBe(200);
    expect((await request(app).get("/documents")).body).toEqual([]);
    expect((await request(app).get(`/documents/${id}/file`)).status).toBe(404);
  });

  test("OFFICIAL cannot change metadata or grants", async () => {
    const ed = await tokenFor("EDITOR");
    const ad = await tokenFor("ADMIN");
    const id = await uploadReleased(ed.token, ad.token, "RES");
    const off = await tokenFor("OFFICIAL");
    expect((await request(app).patch(`/documents/${id}`).set(bearer(off.token)).send({ accessLevel: "PUB" })).status).toBe(403);
    expect((await request(app).put(`/documents/${id}/grants`).set(bearer(off.token)).send({ userIds: [off.user.id] })).status).toBe(403);
  });
});

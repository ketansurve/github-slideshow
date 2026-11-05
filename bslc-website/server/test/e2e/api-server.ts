/* Test API for the Playwright "api" project: starts its own embedded
   PostgreSQL, applies migrations, wipes and seeds known test data, and
   serves the real Express app. Test-only — never deploy this. */
/* eslint-disable @typescript-eslint/no-var-requires */
import fs from "fs";
import os from "os";
import path from "path";
import { E2E_PASSWORD, E2E_USERS } from "./e2e-data";

async function main() {
  const { startPg, migrate } = require("../../scripts/pg.cjs");
  const { url } = await startPg({ name: "e2e-pg", port: 54330, database: "bslc_e2e" });
  migrate(url);

  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: url,
    PORT: process.env.E2E_API_PORT || "8090",
    JWT_SECRET: "e2e-secret-e2e-secret-e2e-secret-012345",
    OTP_DELIVERY: "response",
    AUTH_RATE_LIMIT: "10000",
    PUBLIC_SUBMIT_LIMIT: "10000",
    CORS_ORIGINS: process.env.E2E_SITE_ORIGIN || "http://localhost:4174",
    STORAGE_DIR: path.join(__dirname, "..", "..", ".data", "e2e-uploads"),
  });

  const { prisma } = require("../../src/prisma");
  const { hashPassword } = require("../../src/auth");
  const { storage } = require("../../src/storage");
  const { createApp } = require("../../src/app");

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "ConsultationComment","ConsultationParticipant","Consultation",
    "ContentItem","DocumentGrant","Document","Session","OtpChallenge","User" CASCADE`);

  const hash = await hashPassword(E2E_PASSWORD);
  const mk = (userId: string, name: string, role: string) =>
    prisma.user.create({ data: { userId, name, role, status: "ACTIVE", mobile: "9800012345", passwordHash: hash } });
  const admin = await mk(E2E_USERS.admin, "E2E Administrator", "ADMIN");
  const editor = await mk(E2E_USERS.editor, "E2E Editor", "EDITOR");
  const officer = await mk(E2E_USERS.officer, "E2E Officer", "OFFICIAL");
  await mk(E2E_USERS.citizen, "E2E Citizen", "PUBLIC");

  const pdf = path.join(os.tmpdir(), "bslc-e2e-seed.pdf");
  fs.writeFileSync(pdf, "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
  const docs: Array<[string, "PUB" | "RES" | "CONF"]> = [
    ["E2E Public report", "PUB"],
    ["E2E Restricted minutes", "RES"],
    ["E2E Confidential draft", "CONF"],
  ];
  for (const [title, accessLevel] of docs) {
    const key = `2026/${require("crypto").randomUUID()}.pdf`;
    await storage.put(key, pdf);
    await prisma.document.create({
      data: { title, docType: "Report", year: 2026, issuedOn: new Date("2026-08-12"), accessLevel, pages: 1,
        originalName: "seed.pdf", mime: "application/pdf", sizeBytes: fs.statSync(pdf).size, sha256: "0".repeat(64),
        storageKey: key, scanStatus: "CLEAN", uploadedById: editor.id },
    });
  }
  await prisma.contentItem.create({
    data: { kind: "CIRCULAR", titleEn: "E2E Circular — Office timings", titleHi: "ई2ई परिपत्र", refNo: "Circular No. 99",
      issuedOn: new Date("2026-10-01"), status: "PUBLISHED", publishedAt: new Date(), createdById: admin.id, updatedById: admin.id },
  });
  const c = await prisma.consultation.create({
    data: { title: "E2E Consultation Paper", summary: "Comments invited for the e2e test.", status: "OPEN",
      opensAt: new Date(Date.now() - 86_400_000), closesAt: new Date(Date.now() + 30 * 86_400_000), createdById: editor.id },
  });
  await prisma.consultationParticipant.create({ data: { consultationId: c.id, userId: officer.id, addedBy: editor.id } });
  await prisma.consultation.create({
    data: { title: "E2E Open Call for Suggestions", summary: "Anyone may send suggestions; they are reviewed first.", status: "OPEN",
      visibility: "PRIVATE", allowPublic: true,
      opensAt: new Date(Date.now() - 86_400_000), closesAt: new Date(Date.now() + 30 * 86_400_000), createdById: editor.id },
  });

  createApp().listen(Number(process.env.PORT), () => console.log(`e2e API on ${process.env.PORT}`));
}

main().catch((e) => { console.error(e); process.exit(1); });

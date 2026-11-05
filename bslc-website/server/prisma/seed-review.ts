/* Sample data for LOCAL REVIEW ONLY (npm run seed:review).

   Creates one account per role, sample documents at each access level,
   published notices and two consultations, so a reviewer can try every
   feature with the simulated SMS inbox (OTP_DELIVERY=mock-sms).

   A fresh random password is generated on every run and written, with the
   sign-in IDs, to .data/review-accounts.txt (git-ignored). Nothing secret is
   stored in the repository. Refuses to run when NODE_ENV=production. */
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { prisma } from "../src/prisma";
import { hashPassword } from "../src/auth";
import { storage } from "../src/storage";

const ACCOUNTS = [
  { userId: "admin.review@bslc.localhost", name: "Review Administrator", role: "ADMIN", mobile: "9800000001" },
  { userId: "editor.review@bslc.localhost", name: "Review Editor", role: "EDITOR", mobile: "9800000002" },
  { userId: "officer.review@bslc.localhost", name: "Review Officer", role: "OFFICIAL", mobile: "9800000003" },
  { userId: "citizen.review@bslc.localhost", name: "Review Citizen", role: "PUBLIC", mobile: "9800000004" },
] as const;

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("seed:review must never run in production");
  const password = "Review-" + crypto.randomBytes(6).toString("base64url") + "7";
  const hash = await hashPassword(password);

  const users: Record<string, { id: string }> = {};
  for (const a of ACCOUNTS) {
    users[a.role] = await prisma.user.upsert({
      where: { userId: a.userId },
      create: { ...a, passwordHash: hash, status: "ACTIVE" },
      update: { name: a.name, role: a.role, mobile: a.mobile, passwordHash: hash, status: "ACTIVE", failedAttempts: 0, lockedUntil: null },
    });
  }
  const editor = users.EDITOR.id, admin = users.ADMIN.id, officer = users.OFFICIAL.id;

  const already = await prisma.consultation.findFirst({ where: { title: { startsWith: "Review:" } } });
  if (!already) {
    const pdf = path.join(os.tmpdir(), "bslc-review-sample.pdf");
    fs.writeFileSync(pdf, "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
    const docs: Array<[string, string, "PUB" | "RES" | "CONF", string]> = [
      ["Report No. 42 — Review of the Bihar Land Revenue Procedure (sample)", "Report", "PUB", "2026-09-15"],
      ["Minutes — 92nd sitting of the Commission (sample)", "Minutes", "RES", "2026-10-02"],
      ["Draft recommendations — land revenue procedure (sample)", "Working Paper", "CONF", "2026-10-20"],
    ];
    let paperId: string | null = null;
    for (const [title, docType, accessLevel, date] of docs) {
      const issuedOn = new Date(date + "T00:00:00Z");
      const key = `${issuedOn.getUTCFullYear()}/${crypto.randomUUID()}.pdf`;
      await storage.put(key, pdf);
      const d = await prisma.document.create({
        data: { title, docType, accessLevel, issuedOn, year: issuedOn.getUTCFullYear(), pages: 1,
          originalName: "sample.pdf", mime: "application/pdf", sizeBytes: fs.statSync(pdf).size,
          sha256: crypto.createHash("sha256").update(fs.readFileSync(pdf)).digest("hex"),
          storageKey: key, scanStatus: "SKIPPED", uploadedById: editor },
      });
      if (accessLevel === "PUB") paperId = d.id;
    }
    const now = new Date();
    await prisma.contentItem.createMany({ data: [
      { kind: "NOTIFICATION", titleEn: "Notification No. 5002 — Sittings calendar for November 2026 (sample)", titleHi: "अधिसूचना संख्या 5002 — नवंबर 2026 हेतु बैठक कैलेंडर (नमूना)",
        refNo: "Notification No. 5002", issuedOn: new Date("2026-11-01T00:00:00Z"), status: "PUBLISHED", publishedAt: now, createdById: admin, updatedById: admin },
      { kind: "CIRCULAR", titleEn: "Circular No. 14 — Office timings during Chhath (sample)", titleHi: "परिपत्र संख्या 14 — छठ के दौरान कार्यालय समय (नमूना)",
        refNo: "Circular No. 14", issuedOn: new Date("2026-10-28T00:00:00Z"), status: "PUBLISHED", publishedAt: now, createdById: editor, updatedById: editor },
      { kind: "LINK", titleEn: "India Code — central and state legislation", url: "https://www.indiacode.nic.in/",
        status: "PUBLISHED", publishedAt: now, createdById: editor, updatedById: editor },
    ] });
    const day = 86_400_000;
    const c1 = await prisma.consultation.create({ data: {
      title: "Review: Consultation Paper — Simplification of land revenue procedure",
      summary: "Authorised officials are invited to comment on the draft recommendations before they are finalised.",
      opensAt: new Date(Date.now() - day), closesAt: new Date(Date.now() + 30 * day), status: "OPEN",
      visibility: "PARTICIPANTS", allowPublic: false, documentId: paperId, createdById: editor } });
    await prisma.consultationParticipant.create({ data: { consultationId: c1.id, userId: officer, addedBy: editor } });
    await prisma.consultation.create({ data: {
      title: "Review: Open call for suggestions — Hindi versions of draft rules",
      summary: "Anyone may send suggestions. They are seen only by the Commission and are reviewed before publication.",
      opensAt: new Date(Date.now() - day), closesAt: new Date(Date.now() + 30 * day), status: "OPEN",
      visibility: "PRIVATE", allowPublic: true, createdById: editor } });
  }

  const out = path.resolve(__dirname, "..", ".data", "review-accounts.txt");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, [
    "LOCAL REVIEW ACCOUNTS — generated by `npm run seed:review`. Not for any real system.",
    `Password for every account below: ${password}`,
    "",
    ...ACCOUNTS.map((a) => `${a.role.padEnd(9)} ${a.userId.padEnd(34)} mobile ${a.mobile}`),
    "",
    "Sign-in OTPs appear on the simulated SMS inbox: http://localhost:8080/dev/sms",
    "",
  ].join(os.EOL));
  await prisma.auditLog.create({ data: { action: "SEED_REVIEW", actorUser: "seed-review-script" } });
  console.log(`Review data ready. Accounts and password: ${out}`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); }).finally(() => prisma.$disconnect());

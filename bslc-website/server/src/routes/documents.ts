/* /documents — the Document Archive. Listing and file access are filtered
   by src/policy.ts on every request; managers (ADMIN/EDITOR) upload and
   maintain metadata. Files are only ever served through this route. */
import crypto from "crypto";
import fs from "fs";
import { Router, type Request } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { ah, HttpError } from "../http";
import { audit } from "../audit";
import { requireRole } from "../auth";
import { canDownload, canOpenFile, canSeeDocument, isManager, listableLevels } from "../policy";
import { receiveUpload, validateUpload } from "../uploads";
import { scanFile } from "../scan";
import { storage } from "../storage";

export const documentsRouter = Router();

const ACCESS = ["PUB", "RES", "CONF"] as const;
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").transform((s) => new Date(s + "T00:00:00Z"));

const metaSchema = z.object({
  title: z.string().trim().min(3).max(300),
  docType: z.string().trim().min(2).max(60),
  issuedOn: dateOnly.optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  accessLevel: z.enum(ACCESS).default("RES"),
  pages: z.coerce.number().int().min(1).max(100_000).optional(),
});

async function grantedTo(docId: string, userId?: string) {
  if (!userId) return false;
  return !!(await prisma.documentGrant.findUnique({ where: { documentId_userId: { documentId: docId, userId } } }));
}

type DocRow = Prisma.DocumentGetPayload<object>;
function present(d: DocRow, v: Express.Request["user"], granted: boolean) {
  return {
    id: d.id, title: d.title, docType: d.docType, year: d.year,
    issuedOn: d.issuedOn ? d.issuedOn.toISOString().slice(0, 10) : null,
    accessLevel: d.accessLevel, pages: d.pages, mime: d.mime, sizeBytes: d.sizeBytes,
    canOpen: canOpenFile(v, d, granted),
    canDownload: canOpenFile(v, d, granted) && canDownload(d),
    ...(isManager(v) ? { scanStatus: d.scanStatus, withdrawn: d.withdrawn, originalName: d.originalName, sha256: d.sha256 } : {}),
  };
}

documentsRouter.get("/", ah(async (req, res) => {
  const q = z.object({
    year: z.coerce.number().int().optional(),
    type: z.string().max(60).optional(),
    q: z.string().max(200).optional(),
    access: z.enum(ACCESS).optional(),
  }).parse(req.query);
  const v = req.user;
  const levels = listableLevels(v).filter((l) => !q.access || l === q.access);
  const rows = await prisma.document.findMany({
    where: {
      accessLevel: { in: levels },
      ...(isManager(v) ? {} : { withdrawn: false }),
      year: q.year,
      docType: q.type,
      ...(q.q ? { title: { contains: q.q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ year: "desc" }, { issuedOn: "desc" }, { createdAt: "desc" }],
    take: 1000,
  });
  const grants = v
    ? new Set((await prisma.documentGrant.findMany({ where: { userId: v.id }, select: { documentId: true } })).map((g) => g.documentId))
    : new Set<string>();
  const visible = rows.filter((d) => canSeeDocument(v, d, grants.has(d.id)));
  res.json(visible.map((d) => present(d, v, grants.has(d.id))));
}));

/* Loads a document the viewer may see, or answers as if it did not exist.
   A signed-out visitor asking for non-public material gets 401 so the site
   can send them to login.html?redirect=... */
async function loadVisible(req: Request) {
  const d = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!d) throw new HttpError(404, "Not found");
  const granted = await grantedTo(d.id, req.user?.id);
  if (!canSeeDocument(req.user, d, granted)) {
    if (!req.user && d.accessLevel !== "PUB") throw new HttpError(401, "Sign-in required");
    throw new HttpError(404, "Not found");
  }
  return { d, granted };
}

documentsRouter.get("/:id", ah(async (req, res) => {
  const { d, granted } = await loadVisible(req);
  res.json(present(d, req.user, granted));
}));

documentsRouter.get("/:id/file", ah(async (req, res) => {
  const { d, granted } = await loadVisible(req);
  if (!canOpenFile(req.user, d, granted)) {
    throw new HttpError(403, d.scanStatus === "PENDING" ? "This file is awaiting a malware scan" : "Not permitted");
  }
  const wantDownload = req.query.download === "1";
  if (wantDownload && !canDownload(d)) throw new HttpError(403, "Confidential documents are view only");
  await audit(req, wantDownload ? "DOCUMENT_DOWNLOAD" : "DOCUMENT_VIEW", "Document", d.id, { accessLevel: d.accessLevel });
  const asciiName = d.originalName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  res.set({
    "Content-Type": d.mime,
    "Content-Length": String(d.sizeBytes),
    "Content-Disposition": `${wantDownload ? "attachment" : "inline"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(d.originalName)}`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    "Cache-Control": "private, no-store",
  });
  const s = storage.read(d.storageKey);
  s.on("error", () => { if (!res.headersSent) res.status(500).end(); else res.destroy(); });
  s.pipe(res);
}));

/* ---------------- management (ADMIN / EDITOR) ---------------- */

documentsRouter.post("/", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  await receiveUpload(req, res);
  const file = req.file;
  try {
    if (!file) throw new HttpError(400, "Attach a file in the 'file' field");
    const meta = metaSchema.parse(req.body);
    const year = meta.year ?? meta.issuedOn?.getUTCFullYear();
    if (!year) throw new HttpError(400, "Give issuedOn or year");
    let v;
    try { v = await validateUpload(file); }
    catch (e) {
      await audit(req, "UPLOAD_REJECTED", "Document", null, { name: file.originalname, reason: (e as Error).message });
      throw e;
    }
    let scan;
    try { scan = await scanFile(file.path); }
    catch (e) {
      await audit(req, "UPLOAD_REJECTED", "Document", null, { name: v.originalName, reason: "scanner unavailable" });
      throw new HttpError(503, "The malware scanner is unavailable; try again later");
    }
    if (scan.status === "INFECTED") {
      await audit(req, "UPLOAD_REJECTED_MALWARE", "Document", null, { name: v.originalName, sha256: v.sha256, signature: scan.signature });
      throw new HttpError(422, "The file was rejected by the malware scanner");
    }
    const storageKey = `${year}/${crypto.randomUUID()}.${v.ext}`;
    await storage.put(storageKey, file.path);
    const doc = await prisma.document.create({
      data: {
        title: meta.title, docType: meta.docType, issuedOn: meta.issuedOn, year,
        accessLevel: meta.accessLevel, pages: meta.pages,
        originalName: v.originalName, mime: v.mime, sizeBytes: v.sizeBytes, sha256: v.sha256, storageKey,
        scanStatus: scan.status === "CLEAN" ? "CLEAN" : "PENDING",
        uploadedById: req.user!.id,
      },
    });
    await audit(req, "DOCUMENT_UPLOAD", "Document", doc.id, {
      title: doc.title, accessLevel: doc.accessLevel, sha256: doc.sha256, scanStatus: doc.scanStatus,
    });
    res.status(201).json(present(doc, req.user, false));
  } finally {
    if (file) await fs.promises.rm(file.path, { force: true });
  }
}));

documentsRouter.patch("/:id", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const body = metaSchema.partial().extend({ withdrawn: z.boolean().optional() }).strict().parse(req.body);
  const before = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!before) throw new HttpError(404, "Not found");
  const doc = await prisma.document.update({
    where: { id: before.id },
    data: { ...body, year: body.year ?? body.issuedOn?.getUTCFullYear() ?? undefined },
  });
  await audit(req, "DOCUMENT_UPDATE", "Document", doc.id, {
    changes: body, before: { title: before.title, accessLevel: before.accessLevel, withdrawn: before.withdrawn },
  });
  res.json(present(doc, req.user, false));
}));

/* Manual release when no scanner is deployed: an ADMIN confirms the file
   was checked by other means. Recorded in the audit log. */
documentsRouter.post("/:id/release", requireRole("ADMIN"), ah(async (req, res) => {
  const body = z.object({ note: z.string().trim().min(5).max(500) }).parse(req.body);
  const d = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!d) throw new HttpError(404, "Not found");
  if (d.scanStatus !== "PENDING") throw new HttpError(409, "Only files awaiting a scan can be released");
  const doc = await prisma.document.update({ where: { id: d.id }, data: { scanStatus: "SKIPPED" } });
  await audit(req, "DOCUMENT_RELEASE", "Document", d.id, { note: body.note });
  res.json(present(doc, req.user, false));
}));

documentsRouter.get("/:id/grants", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const grants = await prisma.documentGrant.findMany({
    where: { documentId: req.params.id },
    include: { user: { select: { id: true, userId: true, name: true } } },
  });
  res.json(grants.map((g) => g.user));
}));

documentsRouter.put("/:id/grants", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const body = z.object({ userIds: z.array(z.string().uuid()).max(500) }).parse(req.body);
  const d = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!d) throw new HttpError(404, "Not found");
  await prisma.$transaction([
    prisma.documentGrant.deleteMany({ where: { documentId: d.id } }),
    prisma.documentGrant.createMany({
      data: body.userIds.map((userId) => ({ documentId: d.id, userId, grantedBy: req.user!.id })),
      skipDuplicates: true,
    }),
  ]);
  await audit(req, "DOCUMENT_GRANTS_SET", "Document", d.id, { userIds: body.userIds });
  res.json({ ok: true, count: body.userIds.length });
}));

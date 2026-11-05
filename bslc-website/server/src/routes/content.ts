/* /content — circulars, notifications, notices, external links and records.
   Published public items are readable by anyone; ADMIN/EDITOR create and
   maintain them. Nothing is deleted: items are ARCHIVED. */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { ah, HttpError } from "../http";
import { audit } from "../audit";
import { requireRole } from "../auth";
import { contentVisibleLevels } from "../policy";

export const contentRouter = Router();

const KINDS = ["CIRCULAR", "NOTIFICATION", "NOTICE", "LINK", "RECORD"] as const;
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

/* Only http(s) links, so stored content can never become a javascript: URL. */
const httpUrl = z.string().trim().max(1000).url().refine((u) => /^https?:\/\//i.test(u), "Only http(s) links are allowed");
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").transform((s) => new Date(s + "T00:00:00Z"));

const itemSchema = z.object({
  kind: z.enum(KINDS),
  titleEn: z.string().trim().min(3).max(300),
  titleHi: z.string().trim().max(300).nullable().optional(),
  bodyEn: z.string().trim().max(20_000).nullable().optional(),
  bodyHi: z.string().trim().max(20_000).nullable().optional(),
  url: httpUrl.nullable().optional(),
  refNo: z.string().trim().max(120).nullable().optional(),
  issuedOn: dateOnly.nullable().optional(),
  status: z.enum(STATUSES).default("DRAFT"),
  accessLevel: z.enum(["PUB", "RES"]).default("PUB"),
  documentId: z.string().uuid().nullable().optional(),
}).strict();

const publicFields = {
  id: true, kind: true, titleEn: true, titleHi: true, bodyEn: true, bodyHi: true, url: true,
  refNo: true, issuedOn: true, publishedAt: true, accessLevel: true, documentId: true,
} as const;

contentRouter.get("/", ah(async (req, res) => {
  const q = z.object({
    kind: z.enum(KINDS).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }).parse(req.query);
  const items = await prisma.contentItem.findMany({
    where: { status: "PUBLISHED", kind: q.kind, accessLevel: { in: contentVisibleLevels(req.user) } },
    select: publicFields,
    orderBy: [{ issuedOn: "desc" }, { publishedAt: "desc" }],
    take: q.limit,
  });
  res.json(items);
}));

contentRouter.get("/manage", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const q = z.object({ kind: z.enum(KINDS).optional(), status: z.enum(STATUSES).optional() }).parse(req.query);
  res.json(await prisma.contentItem.findMany({
    where: { kind: q.kind, status: q.status },
    orderBy: { updatedAt: "desc" },
    take: 500,
  }));
}));

async function checkDocument(id?: string | null) {
  if (id && !(await prisma.document.findUnique({ where: { id } }))) throw new HttpError(400, "documentId does not exist");
}

contentRouter.post("/", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const body = itemSchema.parse(req.body);
  await checkDocument(body.documentId);
  const item = await prisma.contentItem.create({
    data: {
      ...body,
      createdById: req.user!.id,
      updatedById: req.user!.id,
      publishedAt: body.status === "PUBLISHED" ? new Date() : null,
    },
  });
  await audit(req, "CONTENT_CREATE", "ContentItem", item.id, { kind: item.kind, status: item.status, titleEn: item.titleEn });
  res.status(201).json(item);
}));

contentRouter.patch("/:id", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const body = itemSchema.partial().parse(req.body);
  const before = await prisma.contentItem.findUnique({ where: { id: req.params.id } });
  if (!before) throw new HttpError(404, "Not found");
  await checkDocument(body.documentId);
  const item = await prisma.contentItem.update({
    where: { id: before.id },
    data: {
      ...body,
      updatedById: req.user!.id,
      ...(body.status === "PUBLISHED" && before.status !== "PUBLISHED" ? { publishedAt: new Date() } : {}),
    },
  });
  await audit(req, "CONTENT_UPDATE", "ContentItem", item.id, { changes: body, before: { status: before.status, titleEn: before.titleEn } });
  res.json(item);
}));

/* /consultations — Public Consultation. Anyone can see which consultations
   are open; only users on a consultation's participant allowlist can read
   and post comments, and only while it is open. ADMIN/EDITOR manage
   consultations and their participants. */
import { Router, type Request } from "express";
import { z } from "zod";
import type { Consultation } from "@prisma/client";
import { prisma } from "../prisma";
import { ah, HttpError } from "../http";
import { audit } from "../audit";
import { requireAuth, requireRole } from "../auth";
import { isManager } from "../policy";

export const consultationsRouter = Router();

const isoDateTime = z.string().datetime({ offset: true }).transform((s) => new Date(s));

const consultationSchema = z.object({
  title: z.string().trim().min(3).max(300),
  summary: z.string().trim().min(3).max(5000),
  opensAt: isoDateTime,
  closesAt: isoDateTime,
  status: z.enum(["DRAFT", "OPEN", "CLOSED"]).default("DRAFT"),
  documentId: z.string().uuid().nullable().optional(),
}).strict();

export const isOpen = (c: Consultation, now = new Date()) => c.status === "OPEN" && c.opensAt <= now && now < c.closesAt;

async function isParticipant(consultationId: string, userId?: string) {
  if (!userId) return false;
  return !!(await prisma.consultationParticipant.findUnique({
    where: { consultationId_userId: { consultationId, userId } },
  }));
}

function present(c: Consultation, participant: boolean) {
  return {
    id: c.id, title: c.title, summary: c.summary, status: c.status, documentId: c.documentId,
    opensAt: c.opensAt.toISOString(), closesAt: c.closesAt.toISOString(),
    isOpen: isOpen(c), isParticipant: participant, canComment: participant && isOpen(c),
  };
}

/* Consultations in DRAFT are visible to managers only. */
async function loadConsultation(req: Request) {
  const c = await prisma.consultation.findUnique({ where: { id: req.params.id } });
  if (!c || (c.status === "DRAFT" && !isManager(req.user))) throw new HttpError(404, "Not found");
  return c;
}

consultationsRouter.get("/", ah(async (req, res) => {
  const rows = await prisma.consultation.findMany({
    where: isManager(req.user) ? {} : { status: { in: ["OPEN", "CLOSED"] } },
    orderBy: { opensAt: "desc" },
    take: 200,
  });
  const mine = req.user
    ? new Set((await prisma.consultationParticipant.findMany({ where: { userId: req.user.id }, select: { consultationId: true } })).map((p) => p.consultationId))
    : new Set<string>();
  res.json(rows.map((c) => present(c, mine.has(c.id))));
}));

consultationsRouter.get("/:id", ah(async (req, res) => {
  const c = await loadConsultation(req);
  res.json(present(c, await isParticipant(c.id, req.user?.id)));
}));

consultationsRouter.get("/:id/comments", requireAuth, ah(async (req, res) => {
  const c = await loadConsultation(req);
  if (!isManager(req.user) && !(await isParticipant(c.id, req.user!.id))) {
    throw new HttpError(403, "Only authorised participants can read the comments");
  }
  const comments = await prisma.consultationComment.findMany({
    where: { consultationId: c.id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, userId: true } } },
  });
  res.json(comments.map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), author: m.user.name, authorId: m.user.userId })));
}));

consultationsRouter.post("/:id/comments", requireAuth, ah(async (req, res) => {
  const c = await loadConsultation(req);
  if (!(await isParticipant(c.id, req.user!.id))) {
    throw new HttpError(403, "Only authorised participants can take part in this consultation");
  }
  if (!isOpen(c)) throw new HttpError(409, "This consultation is not open for comments");
  const body = z.object({ body: z.string().trim().min(2).max(5000) }).strict().parse(req.body);
  const m = await prisma.consultationComment.create({ data: { consultationId: c.id, userId: req.user!.id, body: body.body } });
  await audit(req, "CONSULTATION_COMMENT", "Consultation", c.id, { commentId: m.id, length: body.body.length });
  res.status(201).json({ id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), author: req.user!.name, authorId: req.user!.userId });
}));

/* ---------------- management (ADMIN / EDITOR) ---------------- */

consultationsRouter.post("/", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const body = consultationSchema.parse(req.body);
  if (body.closesAt <= body.opensAt) throw new HttpError(400, "closesAt must be after opensAt");
  const c = await prisma.consultation.create({ data: { ...body, createdById: req.user!.id } });
  await audit(req, "CONSULTATION_CREATE", "Consultation", c.id, { title: c.title, status: c.status });
  res.status(201).json(present(c, false));
}));

consultationsRouter.patch("/:id", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const body = consultationSchema.partial().parse(req.body);
  const before = await prisma.consultation.findUnique({ where: { id: req.params.id } });
  if (!before) throw new HttpError(404, "Not found");
  const opensAt = body.opensAt ?? before.opensAt;
  const closesAt = body.closesAt ?? before.closesAt;
  if (closesAt <= opensAt) throw new HttpError(400, "closesAt must be after opensAt");
  const c = await prisma.consultation.update({ where: { id: before.id }, data: body });
  await audit(req, "CONSULTATION_UPDATE", "Consultation", c.id, { changes: body, before: { status: before.status } });
  res.json(present(c, false));
}));

consultationsRouter.get("/:id/participants", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const rows = await prisma.consultationParticipant.findMany({
    where: { consultationId: req.params.id },
    include: { user: { select: { id: true, userId: true, name: true, role: true } } },
  });
  res.json(rows.map((r) => r.user));
}));

consultationsRouter.post("/:id/participants", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const body = z.object({ userId: z.string().uuid() }).parse(req.body);
  const c = await prisma.consultation.findUnique({ where: { id: req.params.id } });
  if (!c) throw new HttpError(404, "Not found");
  const u = await prisma.user.findUnique({ where: { id: body.userId } });
  if (!u || u.status !== "ACTIVE") throw new HttpError(400, "Participants must be active users");
  await prisma.consultationParticipant.upsert({
    where: { consultationId_userId: { consultationId: c.id, userId: u.id } },
    create: { consultationId: c.id, userId: u.id, addedBy: req.user!.id },
    update: {},
  });
  await audit(req, "CONSULTATION_PARTICIPANT_ADD", "Consultation", c.id, { userId: u.userId });
  res.status(201).json({ id: u.id, userId: u.userId, name: u.name, role: u.role });
}));

consultationsRouter.delete("/:id/participants/:userId", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  await prisma.consultationParticipant.deleteMany({ where: { consultationId: req.params.id, userId: req.params.userId } });
  await audit(req, "CONSULTATION_PARTICIPANT_REMOVE", "Consultation", req.params.id, { userId: req.params.userId });
  res.status(204).end();
}));
